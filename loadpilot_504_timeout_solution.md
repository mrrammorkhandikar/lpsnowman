# LoadPilot API 504 Timeout Debug & Solution

## Problem Summary

The LoadPilot production system occasionally returned **504 Gateway
Timeout** errors when accessing API endpoints such as:

-   `/api/admin/users`
-   `/api/me`

Observed behavior:

  Request   Result
  --------- -----------------
  users     504 after \~30s
  users     401 quickly
  users     504 again

This pattern indicates that **one ECS task becomes temporarily
unresponsive while another responds normally**.

Architecture:

    CloudFront
       ↓
    S3 (Frontend)
       ↓
    api.loadpilot.in
       ↓
    Application Load Balancer
       ↓
    ECS Service (2 tasks)
       ↓
    PostgreSQL

Infrastructure components:

-   AWS CloudFront
-   AWS Application Load Balancer
-   AWS ECS (Fargate)
-   PostgreSQL
-   Node.js Express API

The infrastructure was correctly configured, so the issue was traced to
the **application layer**.

------------------------------------------------------------------------

# Root Cause

The API server runs a background job inside the same Node.js process:

    refreshTriptrackLocationsForAllLoads()

This job:

-   Loops through loads with `triptrack_id`
-   Calls an external **IntuTrack API**
-   Updates database records

If the function:

-   performs slow external API calls
-   processes many loads
-   runs sequential loops

then the **Node.js event loop becomes blocked**, preventing the API
server from responding to requests.

This results in:

    ALB → ECS container → Node busy → request waits → 30s → 504

------------------------------------------------------------------------

# Current Code Pattern

The refresh route triggers the job:

``` ts
app.post("/api/intutrack/trips/refresh-locations", async (_req, res) => {
  const result = await refreshTriptrackLocationsForAllLoads();
  return res.json({ ok: true, ...result });
});
```

The refresh job is also scheduled inside the API server using:

    setInterval(runRefresh, intervalMs)

This means the **API server performs background jobs while serving HTTP
requests**.

------------------------------------------------------------------------

# Recommended Architecture (Best Practice)

Separate the background worker from the API service.

## Current

    API ECS Service
     ├ HTTP routes
     └ Background job

## Recommended

    API ECS Service
    Worker ECS Service

Worker service runs:

    refreshTriptrackLocationsForAllLoads()

This ensures the API server only handles HTTP traffic.

------------------------------------------------------------------------

# Immediate Fix (Short Term)

## 1. Prevent overlapping refresh jobs

``` ts
let refreshRunning = false;

async function safeRefresh() {
  if (refreshRunning) return;
  refreshRunning = true;

  try {
    await refreshTriptrackLocationsForAllLoads();
  } finally {
    refreshRunning = false;
  }
}
```

------------------------------------------------------------------------

## 2. Add timeout protection to external API calls

``` ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

await fetch(url, { signal: controller.signal });
```

This prevents a single API request from blocking the server
indefinitely.

------------------------------------------------------------------------

## 3. Limit concurrency for load processing

Instead of sequential calls:

``` ts
for (const load of loads) {
  await fetchTripStatus(load.triptrack_id);
}
```

Use controlled parallelism:

``` ts
import pLimit from "p-limit";

const limit = pLimit(5);

await Promise.all(
  loads.map(load =>
    limit(() => fetchTripStatus(load.triptrack_id))
  )
);
```

This prevents large loops from overwhelming the event loop.

------------------------------------------------------------------------

# Optional Improvement

Reduce heavy logging inside the request middleware.

Large responses serialized with:

    JSON.stringify(response)

can also briefly block the Node.js event loop.

Limit logging size if necessary.

------------------------------------------------------------------------

# Infrastructure Status

All infrastructure components were correctly configured:

-   ALB health checks
-   ECS tasks
-   CloudFront routing
-   DNS configuration
-   Backend response times (\~13ms--280ms)

The issue was **not infrastructure related**.

------------------------------------------------------------------------

# Final Recommendation

For production stability:

1.  Move IntuTrack refresh job to a **separate ECS worker service**
2.  Add API call timeouts
3.  Limit concurrency
4.  Prevent overlapping refresh runs

This ensures:

-   API containers remain responsive
-   No ALB 504 timeouts occur
-   Background jobs do not interfere with request handling

------------------------------------------------------------------------

# Result

After applying these practices, the architecture becomes:

    CloudFront
       ↓
    S3 (Frontend)
       ↓
    Application Load Balancer
       ↓
    API ECS Service
       ↓
    Worker ECS Service (background jobs)
       ↓
    PostgreSQL

This architecture is **highly scalable and production-safe**.
