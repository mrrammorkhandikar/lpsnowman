## SurePass Live Testing (No Proxy)

This file describes a minimal manual test to verify live SurePass integration (with `SUREPASS_ALLOW_PROXY=false`) using a real Aadhaar and PAN.

### Prerequisites

- `.env` and `backend/.env` contain:

```env
SUREPASS_ALLOW_PROXY=false
SUREPASS_BASE_URL=https://kyc-api.surepass.app
SUREPASS_KYC_BASE_URL=https://kyc-api.surepass.app
SUREPASS_PLAIN_BASE_URL=https://kyc-api.surepass.app
SUREPASS_RC_BASE_URL=https://kyc-api.surepass.app
SUREPASS_TIMEOUT_MS=60000
```

- Docker services are running with the latest backend image:

```powershell
docker compose up --build --no-deps backend
```

### Test Data

- Aadhaar number: `705427660164`
- PAN number: `FNMPM6342D`

### Test 1: Aadhaar Validation

1. Log in as a normal carrier/shipper user via the frontend, so `req.session.userId` is set.
2. From the UI flow that triggers Aadhaar KYC, enter:
   - Aadhaar number: `705427660164`
3. Submit the form and observe:
   - **Expected backend behavior**:
     - Backend calls SurePass: `POST https://kyc-api.surepass.app/api/v1/aadhaar-validation/aadhaar-validation`
     - No 500 from our app unless there is a genuine network failure.
   - Check backend logs for `[surepass] POST /api/v1/aadhaar-validation/aadhaar-validation` and the subsequent response status.

### Test 2: PAN Verification (Encrypted)

1. From the UI flow that triggers PAN KYC, enter:
   - PAN number: `FNMPM6342D`
2. Submit the form and observe:
   - **Expected backend behavior**:
     - Backend uses `SurepassEncryptedClient` to call `/api/v1/pan/pan` on `https://kyc-api.surepass.app`.
     - No 500 from our app unless there is a genuine network failure.
   - Check backend logs for `Surepass PAN verification` entries and the final status.

