#!/bin/bash

# Script to find which IAM user owns the AWS_FRONTEND_ACCESS_KEY_ID

echo "Finding IAM user for access key..."
echo ""

# Get all IAM users
users=$(aws iam list-users --query 'Users[].UserName' --output text)

if [ -z "$users" ]; then
  echo "❌ No IAM users found or AWS CLI not configured"
  exit 1
fi

echo "Checking IAM users..."
echo ""

found=false

for user in $users; do
  # Get access keys for this user
  keys=$(aws iam list-access-keys --user-name "$user" --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null)
  
  if [ -n "$keys" ]; then
    echo "User: $user"
    echo "  Access Keys: $keys"
    echo ""
  fi
done

echo ""
echo "✅ Compare the access keys above with your AWS_FRONTEND_ACCESS_KEY_ID"
echo ""
echo "Once you find the user, run this command to add permissions:"
echo ""
echo "aws iam put-user-policy \\"
echo "  --user-name YOUR_IAM_USERNAME \\"
echo "  --policy-name LogisticsDocumentBucketAccess \\"
echo "  --policy-document file://document-bucket-policy.json"
