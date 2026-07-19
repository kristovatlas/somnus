# ADR 009: Oura Ring Sync Architecture

## Status
Accepted

## Context
Somnus needs to import sleep data from the Oura Ring API v2 so users can correlate their manually-tracked habits with objective sleep metrics. Key decisions include the authentication method, sync strategy, error handling, and how imported data merges with existing records.

## Decision

### Authentication: Personal Access Token (PAT)
- Use PAT via `Authorization: Bearer <token>` header, not OAuth2.
- Rationale: Somnus is a single-user, locally-run app. OAuth2 requires a callback server and registered application — unnecessary complexity. PAT is simpler and the user generates it at cloud.ouraring.com.
- The token is stored in the `user_settings.oura_token` column. It is **never** returned in API responses — only a boolean `oura_token_set` is exposed.

### HTTP Client: Synchronous httpx
- Backend endpoints are synchronous (FastAPI sync handlers), so we use `httpx.Client` (not `AsyncClient`).
- Client is instantiated per-request (inside `with httpx.Client()`) rather than as a global singleton, avoiding connection pool management issues for an app that syncs infrequently.

### Sync Strategy: Date-Range with Upsert
- `GET /api/oura/sync?start_date=&end_date=` with sensible defaults:
  - If `last_oura_sync` exists: start from that date.
  - If never synced: last 30 days.
  - End date defaults to today.
- Three Oura endpoints are called per sync: `daily_sleep` (sleep score), `daily_readiness` (readiness score), `sleep` (detailed periods with HRV, HR, stages, timing).
- Data is merged by date and upserted: new records are created, existing records are updated with fresh Oura data.
- `last_oura_sync` is stored as a UTC datetime on the `user_settings` row.

### Error Handling: Graceful Degradation
- If the primary `daily_sleep` call fails (401, 429, network error), the entire sync fails with a clear error message.
- If secondary calls (`daily_readiness`, `sleep` periods) fail, sync continues with partial data and reports errors in the response.
- Specific error messages for common failures:
  - 401: "Oura token is invalid or expired. Generate a new one at cloud.ouraring.com"
  - 429: "Oura API rate limit reached. Try again in a few minutes."
  - Network: "Could not connect to Oura API. Check your internet connection."

### Data Mapping
- Oura durations are in seconds; converted to rounded minutes for SleepRecord.
- Oura efficiency is 0-100 integer; stored as 0.0-1.0 float.
- Sleep periods filtered to `type=long_sleep` to exclude naps.
- Bedtime/wake time parsed from ISO 8601 datetime strings.

## Consequences
- Users must manually generate and paste a PAT (no OAuth flow).
- Sync is user-initiated (no background polling), keeping the app simple and predictable.
- Partial sync failures are surfaced to the user rather than silently dropped.
- The upsert pattern means manual edits to sleep records would be overwritten on re-sync. This is acceptable because sleep records come from Oura, not user input.
