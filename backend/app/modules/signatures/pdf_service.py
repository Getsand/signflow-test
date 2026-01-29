"""
PDF Signing Service - Handles actual PDF modification
"""
import hashlib
import base64
import io
from typing import Optional

import fitz  # PyMuPDF


class PDFSigningService:
    """
    Service for applying signatures to PDF documents.
    Uses PyMuPDF (fitz) for PDF manipulation.
    """

    @staticmethod
    def apply_signature_to_pdf(
        pdf_bytes: bytes,
        *,
        page_number: int,  # 1-based
        x: float,
        y: float,
        width: float,
        height: float,
        signature_image_base64: Optional[str] = None,
        typed_name: Optional[str] = None,
    ) -> bytes:
        """
        Apply a signature to a PDF at the specified location.
        
        Args:
            pdf_bytes: Original PDF file bytes
            page_number: 1-based page number
            x, y, width, height: Signature box coordinates (PDF points)
            signature_image_base64: Base64 image for DRAW/UPLOAD
            typed_name: Name for TYPED signature
        
        Returns:
            Modified PDF as bytes
        """
        # Load PDF from bytes
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Convert to 0-based page index
        page_index = page_number - 1
        
        if page_index >= len(pdf_document):
            raise ValueError(f"Page {page_number} does not exist in PDF")
        
        page = pdf_document[page_index]
        
        # Define signature rectangle
        # Note: PyMuPDF uses bottom-left origin, but we receive top-left origin
        # Convert y-coordinate
        page_height = page.rect.height
        rect = fitz.Rect(x, page_height - y - height, x + width, page_height - y)
        
        if signature_image_base64:
            # Apply image signature
            PDFSigningService._apply_image_signature(
                page, rect, signature_image_base64
            )
        elif typed_name:
            # Apply typed signature
            PDFSigningService._apply_typed_signature(
                page, rect, typed_name
            )
        else:
            raise ValueError("Either signature_image or typed_name required")
        
        # Save modified PDF to bytes
        output_bytes = pdf_document.write()
        pdf_document.close()
        
        return output_bytes

    @staticmethod
    def _apply_image_signature(
        page: fitz.Page,
        rect: fitz.Rect,
        image_base64: str,
    ) -> None:
        """
        Apply an image-based signature to a PDF page.
        """
        try:
            # Decode base64 image
            image_data = base64.b64decode(image_base64)
            
            # Insert image into PDF
            page.insert_image(rect, stream=image_data)
            
            # Add border around signature
            page.draw_rect(rect, color=(0, 0, 0), width=1)
            
        except Exception as e:
            raise ValueError(f"Invalid signature image: {str(e)}")

    @staticmethod
    def _apply_typed_signature(
        page: fitz.Page,
        rect: fitz.Rect,
        name: str,
    ) -> None:
        """
        Apply a typed signature (text-based) to a PDF page.
        Uses a script-like font to simulate handwriting.
        """
        # Draw rectangle border
        page.draw_rect(rect, color=(0, 0, 0), width=1)
        
        # Calculate font size to fit the box
        font_size = min(rect.height * 0.6, 24)
        
        # Try to insert text with italic font, fallback to regular if needed
        try:
            # Use Times-Roman italic (more reliable than helv-italic)
            page.insert_text(
                (rect.x0 + 5, rect.y0 + rect.height * 0.7),
                name,
                fontsize=font_size,
                fontname="tiro",  # Times-Roman italic (built-in)
                color=(0, 0, 0),
            )
        except Exception:
            # Fallback to regular font if italic fails
            try:
                page.insert_text(
                    (rect.x0 + 5, rect.y0 + rect.height * 0.7),
                    name,
                    fontsize=font_size,
                    fontname="helv",  # Helvetica regular (always available)
                    color=(0, 0, 0),
                )
            except Exception:
                # Last resort: use default font
                page.insert_text(
                    (rect.x0 + 5, rect.y0 + rect.height * 0.7),
                    name,
                    fontsize=font_size,
                    color=(0, 0, 0),
                )

    @staticmethod
    def calculate_pdf_hash(pdf_bytes: bytes) -> str:
        """
        Calculate SHA-256 hash of PDF document.
        
        Args:
            pdf_bytes: PDF file bytes
        
        Returns:
            Hex string of SHA-256 hash
        """
        return hashlib.sha256(pdf_bytes).hexdigest()

