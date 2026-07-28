#!/bin/bash

# Verify S3 Configuration for Admin Document Fetching
# This script checks if S3 is properly configured for document fetching

echo "========================================="
echo "S3 Configuration Verification"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BUCKET_NAME="logistics-app-prod-documents"
EXPECTED_PREFIX="documents"

echo "1. Checking S3 Bucket Existence..."
if aws s3 ls "s3://${BUCKET_NAME}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Bucket exists: ${BUCKET_NAME}"
else
    echo -e "${RED}✗${NC} Bucket not found: ${BUCKET_NAME}"
    echo "   Please verify the bucket name is correct"
    exit 1
fi
echo ""

echo "2. Checking Files in documents/ prefix..."
FILE_COUNT=$(aws s3 ls "s3://${BUCKET_NAME}/${EXPECTED_PREFIX}/" --recursive | wc -l)
if [ "$FILE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Found ${FILE_COUNT} files in ${EXPECTED_PREFIX}/ prefix"
    echo "   Sample files:"
    aws s3 ls "s3://${BUCKET_NAME}/${EXPECTED_PREFIX}/" --recursive | head -5 | sed 's/^/   /'
else
    echo -e "${YELLOW}⚠${NC} No files found in ${EXPECTED_PREFIX}/ prefix"
    echo "   This might be normal if no documents have been uploaded yet"
fi
echo ""

echo "3. Checking IAM Permissions..."
TEST_KEY="${EXPECTED_PREFIX}/test-permissions-check.txt"
echo "test" > /tmp/test-file.txt

# Try to upload
if aws s3 cp /tmp/test-file.txt "s3://${BUCKET_NAME}/${TEST_KEY}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} PutObject permission: OK"
    
    # Try to download
    if aws s3 cp "s3://${BUCKET_NAME}/${TEST_KEY}" /tmp/test-download.txt > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} GetObject permission: OK"
    else
        echo -e "${RED}✗${NC} GetObject permission: FAILED"
        echo "   The IAM user cannot read from the bucket"
    fi
    
    # Try to delete
    if aws s3 rm "s3://${BUCKET_NAME}/${TEST_KEY}" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} DeleteObject permission: OK"
    else
        echo -e "${YELLOW}⚠${NC} DeleteObject permission: FAILED (not critical)"
    fi
else
    echo -e "${RED}✗${NC} PutObject permission: FAILED"
    echo "   The IAM user cannot write to the bucket"
fi

rm -f /tmp/test-file.txt /tmp/test-download.txt
echo ""

echo "4. Checking S3 Bucket Region..."
BUCKET_REGION=$(aws s3api get-bucket-location --bucket "${BUCKET_NAME}" --query 'LocationConstraint' --output text)
if [ "$BUCKET_REGION" = "None" ]; then
    BUCKET_REGION="us-east-1"
fi
echo "   Bucket region: ${BUCKET_REGION}"
if [ "$BUCKET_REGION" = "ap-south-1" ]; then
    echo -e "${GREEN}✓${NC} Region matches expected: ap-south-1"
else
    echo -e "${YELLOW}⚠${NC} Region is ${BUCKET_REGION}, expected ap-south-1"
    echo "   Update AWS_REGION environment variable to: ${BUCKET_REGION}"
fi
echo ""

echo "5. Checking CORS Configuration..."
if aws s3api get-bucket-cors --bucket "${BUCKET_NAME}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} CORS configuration exists"
    echo "   Current CORS rules:"
    aws s3api get-bucket-cors --bucket "${BUCKET_NAME}" | jq -r '.CORSRules[] | "   - Allowed Origins: \(.AllowedOrigins | join(", "))"'
else
    echo -e "${YELLOW}⚠${NC} No CORS configuration found"
    echo "   This might cause issues with browser-based document access"
    echo "   Consider adding CORS rules for: https://www.loadsmart.in"
fi
echo ""

echo "========================================="
echo "Summary"
echo "========================================="
echo ""
echo "Required Environment Variables:"
echo "  AWS_BUCKET_NAME=${BUCKET_NAME}"
echo "  AWS_REGION=${BUCKET_REGION}"
echo "  AWS_OBJECT_PREFIX=${EXPECTED_PREFIX}"
echo ""
echo "GitHub Secrets to verify:"
echo "  1. AWS_BUCKET_NAME = ${BUCKET_NAME}"
echo "  2. AWS_REGION = ${BUCKET_REGION}"
echo "  3. AWS_OBJECT_PREFIX = ${EXPECTED_PREFIX}"
echo "  4. AWS_FRONTEND_ACCESS_KEY_ID = AKIA..."
echo "  5. AWS_FRONTEND_SECRET_ACCESS_KEY = ..."
echo ""
echo "Next steps:"
echo "  1. Verify GitHub Secrets match the values above"
echo "  2. Deploy the updated backend code"
echo "  3. Check CloudWatch logs for S3 configuration"
echo "  4. Test document fetching in admin panel"
echo ""
