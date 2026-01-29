#!/bin/bash

# Test Email Sending API
# This script tests the signing request send endpoint which triggers email sending

BASE_URL="http://localhost:8000"

echo "=========================================="
echo "Testing Email Sending API"
echo "=========================================="
echo ""

# Step 1: Login to get JWT token
echo "Step 1: Login to get JWT token"
echo "----------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }')

echo "Login Response:"
echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Extract token (adjust based on your API response format)
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get token. Please check your credentials."
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."
echo ""

# Step 2: List signing requests to get a DRAFT request ID
echo "Step 2: List signing requests"
echo "----------------------------------------"
REQUESTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/v1/signing-requests" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Signing Requests:"
echo "$REQUESTS_RESPONSE" | jq '.' 2>/dev/null || echo "$REQUESTS_RESPONSE"
echo ""

# Extract first DRAFT request ID (adjust based on your needs)
SIGNING_REQUEST_ID=$(echo "$REQUESTS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$SIGNING_REQUEST_ID" ]; then
  echo "ERROR: No signing requests found. Please create a signing request first."
  exit 1
fi

echo "Using Signing Request ID: $SIGNING_REQUEST_ID"
echo ""

# Step 3: Get signing request detail to check status and recipients
echo "Step 3: Get signing request detail"
echo "----------------------------------------"
DETAIL_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/v1/signing-requests/${SIGNING_REQUEST_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Signing Request Detail:"
echo "$DETAIL_RESPONSE" | jq '.' 2>/dev/null || echo "$DETAIL_RESPONSE"
echo ""

STATUS=$(echo "$DETAIL_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "Current Status: $STATUS"
echo ""

if [ "$STATUS" != "DRAFT" ]; then
  echo "WARNING: Signing request is not in DRAFT status. Cannot send."
  echo "Please create a new signing request or use a DRAFT request."
  exit 1
fi

# Step 4: Send signing request (triggers email sending)
echo "Step 4: Send signing request (triggers email sending)"
echo "----------------------------------------"
SEND_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/signing-requests/${SIGNING_REQUEST_ID}/send" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

echo "Send Response:"
echo "$SEND_RESPONSE" | jq '.' 2>/dev/null || echo "$SEND_RESPONSE"
echo ""

NEW_STATUS=$(echo "$SEND_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "New Status: $NEW_STATUS"
echo ""

if [ "$NEW_STATUS" = "SENT" ]; then
  echo "✅ SUCCESS: Signing request sent successfully!"
  echo ""
  echo "Check backend logs for email sending status:"
  echo "  docker-compose logs backend | grep -i email"
else
  echo "❌ ERROR: Failed to send signing request"
fi

echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="
