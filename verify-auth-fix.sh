#!/bin/bash

# Authentication Fix Verification Script
# This script helps verify that the authentication persistence fix is working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

echo ""
echo "================================================"
echo "  Authentication Fix Verification"
echo "================================================"
echo ""

# Check 1: Verify GitHub Secret exists
echo "📋 Step 1: Checking GitHub Secrets..."
echo ""
print_info "Please verify manually in GitHub:"
print_info "  Repository → Settings → Secrets and variables → Actions"
echo ""
print_info "Required secrets:"
echo "  - VITE_API_BASE_URL (NEW - must be added)"
echo "  - COOKIE_DOMAIN"
echo "  - FRONTEND_URL"
echo "  - SESSION_SECRET"
echo ""
read -p "Have you added VITE_API_BASE_URL secret? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Please add VITE_API_BASE_URL secret before continuing"
    echo ""
    print_info "Value should be: https://api.yourdomain.com (your backend URL)"
    exit 1
fi
print_success "GitHub secrets verified"
echo ""

# Check 2: Verify files exist
echo "📋 Step 2: Checking modified files..."
echo ""

FILES=(
    "frontend/src/lib/api-client.ts"
    "frontend/.env.example"
    "AUTHENTICATION_FIX_SUMMARY.md"
    "DEPLOYMENT_INSTRUCTIONS.md"
    "QUICK_FIX_GUIDE.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_error "$file is missing"
        exit 1
    fi
done
echo ""

# Check 3: Verify auth-context uses API client
echo "📋 Step 3: Checking auth-context.tsx..."
echo ""
if grep -q "import.*api-client" frontend/src/lib/auth-context.tsx; then
    print_success "auth-context.tsx imports API client"
else
    print_error "auth-context.tsx doesn't import API client"
    exit 1
fi

if grep -q "apiGet\|apiPost" frontend/src/lib/auth-context.tsx; then
    print_success "auth-context.tsx uses API client functions"
else
    print_error "auth-context.tsx doesn't use API client functions"
    exit 1
fi
echo ""

# Check 4: Verify queryClient uses API client
echo "📋 Step 4: Checking queryClient.ts..."
echo ""
if grep -q "import.*getApiUrl.*api-client" frontend/src/lib/queryClient.ts; then
    print_success "queryClient.ts imports getApiUrl"
else
    print_error "queryClient.ts doesn't import getApiUrl"
    exit 1
fi
echo ""

# Check 5: Verify deployment workflow
echo "📋 Step 5: Checking deployment workflow..."
echo ""
if grep -q "VITE_API_BASE_URL" .github/workflows/frontend-production-deploy.yml; then
    print_success "Frontend deployment workflow includes VITE_API_BASE_URL"
else
    print_error "Frontend deployment workflow missing VITE_API_BASE_URL"
    exit 1
fi
echo ""

# Check 6: Git status
echo "📋 Step 6: Checking git status..."
echo ""
if git diff --quiet; then
    print_warning "No uncommitted changes"
else
    print_info "You have uncommitted changes:"
    git status --short
    echo ""
    read -p "Do you want to commit these changes? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Fix: Add API client for production authentication persistence

- Created centralized API client with environment-aware URLs
- Updated auth-context to use API client
- Updated queryClient to use API client
- Updated marketplace-socket for proper WebSocket URLs
- Added VITE_API_BASE_URL environment variable support
- Updated frontend deployment workflow

This fixes the authentication persistence issue where users
could log in but sessions were not maintained after page
refresh in production."
        print_success "Changes committed"
    fi
fi
echo ""

# Check 7: Current branch
echo "📋 Step 7: Checking current branch..."
echo ""
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "prod" ]; then
    print_success "On prod branch"
else
    print_warning "Not on prod branch (current: $CURRENT_BRANCH)"
    read -p "Do you want to switch to prod branch? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout prod
        git pull origin prod
        print_success "Switched to prod branch"
    fi
fi
echo ""

# Summary
echo "================================================"
echo "  Verification Complete"
echo "================================================"
echo ""
print_success "All checks passed!"
echo ""
print_info "Next steps:"
echo "  1. Push to prod branch to trigger deployment:"
echo "     git push origin prod"
echo ""
echo "  2. Wait for GitHub Actions to complete (5-10 minutes)"
echo ""
echo "  3. Test authentication:"
echo "     - Open your frontend URL"
echo "     - Login with test credentials"
echo "     - Refresh the page (F5)"
echo "     - You should stay logged in ✓"
echo ""
echo "  4. If issues occur, see DEPLOYMENT_INSTRUCTIONS.md"
echo ""
print_info "For detailed troubleshooting, see:"
echo "  - QUICK_FIX_GUIDE.md (quick reference)"
echo "  - DEPLOYMENT_INSTRUCTIONS.md (detailed guide)"
echo "  - AUTHENTICATION_FIX_SUMMARY.md (technical analysis)"
echo ""
