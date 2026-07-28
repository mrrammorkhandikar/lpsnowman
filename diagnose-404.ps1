# PowerShell Script to Diagnose 404 Document Error
# Run this to identify the exact issue

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Document 404 Error Diagnosis" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$BUCKET = "logistics-app-prod-documents"

# Step 1: Check S3 bucket structure
Write-Host "1. Checking S3 bucket structure..." -ForegroundColor Yellow
Write-Host ""

Write-Host "   Files in root:" -ForegroundColor White
aws s3 ls "s3://$BUCKET/" 2>&1 | Select-Object -First 10

Write-Host ""
Write-Host "   Files in 'documents/' folder:" -ForegroundColor White
aws s3 ls "s3://$BUCKET/documents/" --recursive 2>&1 | Select-Object -First 10

Write-Host ""
Write-Host "   Files in 'uploads/' folder:" -ForegroundColor White
aws s3 ls "s3://$BUCKET/uploads/" --recursive 2>&1 | Select-Object -First 10

Write-Host ""
Write-Host "   All files (first 20):" -ForegroundColor White
aws s3 ls "s3://$BUCKET/" --recursive 2>&1 | Select-Object -First 20

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Analysis" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Step 2: Check GitHub Secrets
Write-Host "2. Required GitHub Secrets:" -ForegroundColor Yellow
Write-Host "   Go to: https://github.com/sanyam-ls/loadsmart-logistics/settings/secrets/actions" -ForegroundColor White
Write-Host ""
Write-Host "   Verify these secrets:" -ForegroundColor White
Write-Host "   - AWS_BUCKET_NAME = $BUCKET" -ForegroundColor Gray
Write-Host "   - AWS_REGION = ap-south-1" -ForegroundColor Gray
Write-Host "   - AWS_OBJECT_PREFIX = ??? (this is the key!)" -ForegroundColor Red
Write-Host ""

# Step 3: Determine correct prefix
Write-Host "3. Determining correct AWS_OBJECT_PREFIX..." -ForegroundColor Yellow
Write-Host ""

$documentsCount = (aws s3 ls "s3://$BUCKET/documents/" --recursive 2>&1 | Measure-Object).Count
$uploadsCount = (aws s3 ls "s3://$BUCKET/uploads/" --recursive 2>&1 | Measure-Object).Count

Write-Host "   Files in 'documents/' folder: $documentsCount" -ForegroundColor White
Write-Host "   Files in 'uploads/' folder: $uploadsCount" -ForegroundColor White
Write-Host ""

if ($documentsCount -gt 0) {
    Write-Host "   ✓ Files found in 'documents/' folder" -ForegroundColor Green
    Write-Host "   → AWS_OBJECT_PREFIX should be: documents" -ForegroundColor Green
} elseif ($uploadsCount -gt 0) {
    Write-Host "   ✓ Files found in 'uploads/' folder" -ForegroundColor Green
    Write-Host "   → AWS_OBJECT_PREFIX should be: uploads" -ForegroundColor Green
} else {
    Write-Host "   ✗ No files found in either folder" -ForegroundColor Red
    Write-Host "   → Check if files are in root or another location" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Update GitHub Secret AWS_OBJECT_PREFIX to match where files are" -ForegroundColor White
Write-Host "2. Re-run GitHub Actions deployment" -ForegroundColor White
Write-Host "3. Check CloudWatch logs for correct prefix" -ForegroundColor White
Write-Host "4. Test document viewing again" -ForegroundColor White
Write-Host ""
