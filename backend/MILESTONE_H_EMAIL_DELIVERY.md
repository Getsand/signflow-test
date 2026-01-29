# Milestone H: Signing Link Email Delivery

## Overview

This milestone implements email delivery for signing invitations using Resend API. When a signing request is sent, unique signing tokens are generated for each recipient and invitation emails are sent with signing links.

## Implementation Details

### Database Changes

**Migration:** `2334a9693a34_add_signing_token_and_sent_at_to_recipients`

Added to `signing_request_recipients` table:
- `signing_token` (String(64), nullable, unique, indexed) - Unique token for signing link
- `sent_at` (DateTime, nullable) - Timestamp when email was sent

### Configuration

New environment variables required:

```bash
# Resend API Key (get from https://resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Email sender address (must be verified in Resend)
EMAIL_FROM=noreply@yourdomain.com

# Frontend base URL for signing links
FRONTEND_BASE_URL=http://localhost:5173
```

### Email Service

**File:** `app/core/email.py`

The `EmailService` class provides:
- `generate_signing_token()` - Generates secure 64-character URL-safe tokens
- `build_signing_url(token)` - Builds signing URL: `{FRONTEND_BASE_URL}/sign/{token}`
- `send_signing_invitation(...)` - Sends HTML and plain text emails via Resend

**Features:**
- Graceful degradation: If `RESEND_API_KEY` is not set, logs email details instead of failing
- Error handling: Logs errors but doesn't break workflow
- Professional email templates with HTML and plain text versions

### Updated Endpoint

**POST `/api/v1/signing-requests/{id}/send`**

**Flow:**
1. Validates signing request is in DRAFT status
2. Validates signature fields exist
3. Validates recipients exist
4. For each recipient:
   - Generates unique `signing_token`
   - Builds signing URL: `{FRONTEND_BASE_URL}/sign/{token}`
   - Sends invitation email via EmailService
   - Updates recipient with `signing_token` and `sent_at` (if email sent successfully)
5. Updates signing request status to SENT
6. Sets signing request `sent_at` timestamp

**Error Handling:**
- If email sending fails for a recipient, token is still generated but `sent_at` is not set
- Workflow continues even if some emails fail
- All actions are logged for debugging

## Email Template

The email includes:
- Professional HTML design with SignFlow branding
- Document title
- Recipient role/name
- Signing button with link
- Plain text fallback
- Security note about unique links

## Dependencies

Added to `requirements.txt`:
- `resend>=0.6.0` - Resend Python SDK

## Testing

### Without Resend API Key (Development)

If `RESEND_API_KEY` is not set, the service will:
- Log email details to console
- Generate tokens and update database
- Not send actual emails

### With Resend API Key (Production)

1. Get API key from https://resend.com
2. Verify sender domain/email in Resend dashboard
3. Set environment variables
4. Test sending a signing request

## Security Considerations

- Tokens are cryptographically secure (64-character URL-safe)
- Each recipient gets a unique token
- Tokens are stored in database for validation
- Email links expire after signing (to be implemented in signer UI)

## Logging

All email operations are logged:
- Email send attempts
- Success/failure status
- Token generation (first 8 chars for debugging)
- Errors with full stack traces

## Next Steps

- Frontend: Implement `/sign/{token}` route for signer UI
- Token validation endpoint
- Token expiration logic
- Email retry mechanism (optional)
