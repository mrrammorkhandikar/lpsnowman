# PowerShell script to find which IAM user owns the AWS_FRONTEND_ACCESS_KEY_ID

Write-Host "Finding IAM user for access key..." -ForegroundColor Cyan
Write-Host ""

# Get all IAM users
try {
    $users = aws iam list-users --query 'Users[].UserName' --output text
    
    if ([string]::IsNullOrWhiteSpace($users)) {
        Write-Host "❌ No IAM users found or AWS CLI not configured" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Checking IAM users..." -ForegroundColor Yellow
    Write-Host ""
    
    $userList = $users -split '\s+'
    
    foreach ($user in $userList) {
        if ([string]::IsNullOrWhiteSpace($user)) { continue }
        
        # Get access keys for this user
        $keys = aws iam list-access-keys --user-name $user --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>$null
        
        if (![string]::IsNullOrWhiteSpace($keys)) {
            Write-Host "User: $user" -ForegroundColor Green
            Write-Host "  Access Keys: $keys" -ForegroundColor White
            Write-Host ""
        }
    }
    
    Write-Host ""
    Write-Host "✅ Compare the access keys above with your AWS_FRONTEND_ACCESS_KEY_ID" -ForegroundColor Green
    Write-Host ""
    Write-Host "Once you find the user, run this command to add permissions:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "aws iam put-user-policy ``" -ForegroundColor Cyan
    Write-Host "  --user-name YOUR_IAM_USERNAME ``" -ForegroundColor Cyan
    Write-Host "  --policy-name LogisticsDocumentBucketAccess ``" -ForegroundColor Cyan
    Write-Host "  --policy-document file://document-bucket-policy.json" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure AWS CLI is installed and configured:" -ForegroundColor Yellow
    Write-Host "  aws configure" -ForegroundColor Cyan
}
