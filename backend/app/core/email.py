"""
Email Service - Resend API integration

Handles sending signing invitation emails via Resend.
Email logic is isolated from business logic.
"""

import secrets
import logging
from typing import Optional

import resend
from resend.exceptions import ResendError

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailService:
    """
    Email service for sending signing invitation emails.
    
    Uses Resend API for email delivery.
    Logs email sending instead of failing silently.
    """

    def __init__(self):
        """Initialize Resend client"""
        if settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY
        self.from_email = settings.EMAIL_FROM
        self.frontend_base_url = settings.FRONTEND_BASE_URL.rstrip('/')

    def generate_signing_token(self) -> str:
        """
        Generate a secure random token for signing links.
        
        Returns:
            64-character hexadecimal token
        """
        return secrets.token_urlsafe(48)  # 48 bytes = 64 chars base64url

    def build_signing_url(self, token: str) -> str:
        """
        Build the signing URL for a recipient.
        
        Args:
            token: Signing token for the recipient
            
        Returns:
            Full URL to the signing page
        """
        return f"{self.frontend_base_url}/sign/{token}"

    def send_signing_invitation(
        self,
        *,
        to_email: str,
        recipient_name: str,
        document_title: str,
        signing_url: str,
    ) -> bool:
        """
        Send signing invitation email to a recipient.
        
        Args:
            to_email: Recipient email address
            recipient_name: Name/role of the recipient (e.g., "Signer 1")
            document_title: Title of the document to sign
            signing_url: URL to the signing page
            
        Returns:
            True if email was sent successfully, False otherwise
            
        Note:
            Logs errors but does not raise exceptions to avoid breaking the workflow.
        """
        if not settings.RESEND_API_KEY:
            logger.warning(
                f"Email service not configured (RESEND_API_KEY missing). "
                f"Would send invitation to {to_email} for document '{document_title}'"
            )
            logger.info(f"Signing URL: {signing_url}")
            return False

        try:
            # Build email content
            subject = f"Please sign: {document_title}"
            html_content = self._build_email_html(
                recipient_name=recipient_name,
                document_title=document_title,
                signing_url=signing_url,
            )
            text_content = self._build_email_text(
                recipient_name=recipient_name,
                document_title=document_title,
                signing_url=signing_url,
            )

            # Send email via Resend
            response = resend.Emails.send({
                "from": self.from_email,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
                "text": text_content,
            })

            logger.info(
                f"Signing invitation email sent successfully to {to_email} "
                f"for document '{document_title}' (Resend ID: {response.get('id', 'unknown')})"
            )
            return True

        except ResendError as e:
            logger.error(
                f"Failed to send signing invitation email to {to_email}: {e}",
                exc_info=True
            )
            return False
        except Exception as e:
            logger.error(
                f"Unexpected error sending email to {to_email}: {e}",
                exc_info=True
            )
            return False

    def _build_email_html(
        self,
        *,
        recipient_name: str,
        document_title: str,
        signing_url: str,
    ) -> str:
        """Build HTML email content"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">SignFlow</h1>
            </div>
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                <h2 style="color: #111827; margin-top: 0;">Action Required: Please Sign Document</h2>
                <p>Hello {recipient_name},</p>
                <p>You have been requested to sign the following document:</p>
                <div style="background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0;">
                    <strong>{document_title}</strong>
                </div>
                <p>Please click the button below to review and sign the document:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{signing_url}" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                        Sign Document
                    </a>
                </div>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="{signing_url}" style="color: #4F46E5; word-break: break-all;">{signing_url}</a>
                </p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                    This link is unique to you and will expire after signing.
                </p>
            </div>
        </body>
        </html>
        """

    def _build_email_text(
        self,
        *,
        recipient_name: str,
        document_title: str,
        signing_url: str,
    ) -> str:
        """Build plain text email content"""
        return f"""
SignFlow - Action Required: Please Sign Document

Hello {recipient_name},

You have been requested to sign the following document:

{document_title}

Please click the link below to review and sign the document:

{signing_url}

This link is unique to you and will expire after signing.

---
SignFlow - Secure Document Signing
        """.strip()
