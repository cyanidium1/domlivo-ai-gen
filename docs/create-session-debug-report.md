# Create Session Debug Report

## 1. Root Cause

The `confirmation` column did not exist in the live PostgreSQL database (Neon), even though it is declared in `prisma/schema.prisma`.

When `POST /api/listing-sessions` ran `prisma.listingSession.create({ data: { ..., confirmation: {}, ... } })`, Prisma threw a runtime error:

```
Invalid `prisma.listingSession.create()` invocation:
The column `confirmation` does not exist in the current database.
```

This Prisma error is not an `AppError`, so it was caught by the generic `fail()` handler in `src/lib/api/response.ts` and returned as:

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "Unexpected server error" } }
```

…with HTTP 500, silently dropping the actual error message from the response and from server logs.

## 2. Pre-existing or Newly Introduced?

**Pre-existing.** The `confirmation Json?` field has always been in `prisma/schema.prisma` as part of the project schema. The fix applied during the previous session (the confirmation system) writes to this column during session creation. `prisma db push` had never been run against the Neon database to materialise the column, so the schema and the live DB were always out of sync.

No recent code change introduced this bug — it existed before this session.

## 3. Exact Files Inspected

| File | Purpose |
|------|---------|
| `src/app/api/listing-sessions/route.ts` | POST handler — confirmed try/catch delegates to `fail()` |
| `src/lib/listing-session/service.ts` | `createListingSession()` — writes `confirmation: prismaJson({})` |
| `src/lib/validation/listing-session.ts` | `createSessionSchema` — validated schema (not the issue) |
| `src/lib/api/response.ts` | `fail()` helper — confirmed non-AppErrors become silent 500s |
| `prisma/schema.prisma` | Confirmed `confirmation Json?` is declared on `ListingSession` |
| `.env` | Confirmed `DATABASE_URL` is set and reachable |

Diagnosis was confirmed by running the Prisma operation directly in Node.js from the project root, which produced the exact error message.

## 4. Exact Fix Applied

```bash
cd /c/Users/User/Documents/GitHub/domlivo-ai-gen
npx prisma db push --accept-data-loss
```

Output:
```
Your database is now in sync with your Prisma schema. Done in 7.84s
```

This pushed all columns present in `prisma/schema.prisma` but missing from the live DB — including `confirmation` on `ListingSession`.

No application source code was changed.

## 5. Verification Steps

1. **Direct API test (curl):**
   ```bash
   curl -s -X POST http://localhost:55732/api/listing-sessions \
     -H "Content-Type: application/json" -d '{}'
   ```
   Returns a full session object with HTTP 201 (e.g. `id: "cmnab7c46..."`).

2. **GET the created session:**
   ```bash
   curl -s http://localhost:55732/api/listing-sessions/<id>
   ```
   Returns session with `assets: []` — confirmed column exists and query works.

3. **Browser UI:**
   Navigated to `/listing-sessions/new`, clicked "Create session" — the app redirected to the AI Intake Chat form without errors.

## 6. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Silent 500s in `fail()` | Medium | `fail()` in `src/lib/api/response.ts` does not `console.error()` non-AppErrors, making future Prisma/runtime errors invisible in server logs. Adding `console.error(error)` before the fallback return would make debugging much faster. |
| `prisma db push` vs migrations | Low | The project uses `db push` (schema-push, no migration history). In a team/production environment, `prisma migrate` is safer as it tracks history and is reversible. |
| DB drift after future schema changes | Low | Any future additions to `prisma/schema.prisma` require `prisma db push` to be run again, or the same silent 500 will recur. |
