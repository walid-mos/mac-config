# Plan: Replace Auth Hook with `admin.generateLink()` Approach

## Context

The current implementation uses a Supabase Auth Hook (`POST /api/auth/hook`) to intercept auth emails and send them via email-manager/Resend. This approach has critical flaws:
- **Single webhook URL** — Supabase only allows one hook URL, so you can't have both `localhost:4321` (dev) and `ysumai.app` (prod)
- **Manual dashboard config** — requires manual setup in Supabase dashboard per environment
- **Current 500 error** — the magic-link endpoint is failing because `signInWithOtp()` tries to send Supabase's built-in email (which may conflict with the hook config)

**Better approach**: Use `supabase.auth.admin.generateLink()` with the `service_role` key to generate auth links server-side WITHOUT Supabase sending any email, then send emails ourselves via email-manager. Works on any environment, no webhook needed.

## Changes

### 1. Add admin Supabase client — `src/lib/supabase/admin.ts` (NEW)
- Create a minimal admin client using `createClient` (not `createServerClient` — no cookies needed)
- Uses `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Singleton pattern, server-only

### 2. Rewrite `src/pages/api/auth/magic-link.ts` (MODIFY)
- Instead of `signInWithOtp()`, call `adminSupabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })`
- This returns `data.properties.action_link` — the magic link URL
- Send the email via `getEmailManager().send()` with the `MagicLinkEmail` template
- Keep existing Zod validation and error handling

### 3. Replace env var in `astro.config.mjs` (MODIFY)
- Remove `SUPABASE_AUTH_HOOK_SECRET`
- Add `SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret" })`

### 4. Update `.env.example` (MODIFY)
- Remove `SUPABASE_AUTH_HOOK_SECRET`
- Add `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`

### 5. Delete `src/pages/api/auth/hook.ts` (DELETE)
- No longer needed — emails are sent directly from the magic-link endpoint

### 6. Delete `src/pages/api/auth/hook.test.ts` (DELETE)

### 7. Clean up `src/lib/email/auth-hook-types.ts` (MODIFY)
- Remove Supabase Auth Hook payload schema (no longer needed)
- Keep `EMAIL_SUBJECTS` and `EmailEvent` type if useful, otherwise simplify

### 8. Update tests for magic-link endpoint (MODIFY/CREATE)
- Update `src/pages/api/auth/magic-link.ts` tests to mock `admin.generateLink()` and `emailManager.send()`

### 9. Update `docs/swarm/custom-email-templates/supabase-auth-hook-setup.md` (MODIFY)
- Replace hook setup instructions with a note that no dashboard config is needed
- Just document the `SUPABASE_SERVICE_ROLE_KEY` env var

## Files Summary

| Action | File |
|--------|------|
| NEW | `src/lib/supabase/admin.ts` |
| MODIFY | `src/pages/api/auth/magic-link.ts` |
| MODIFY | `astro.config.mjs` |
| MODIFY | `.env.example` |
| DELETE | `src/pages/api/auth/hook.ts` |
| DELETE | `src/pages/api/auth/hook.test.ts` |
| MODIFY | `src/lib/email/auth-hook-types.ts` |
| MODIFY | `docs/swarm/custom-email-templates/supabase-auth-hook-setup.md` |

## Verification

1. `pnpm test` — all tests pass
2. `pnpm build` — build succeeds
3. Manual test: set `SUPABASE_SERVICE_ROLE_KEY` in `.env`, run `pnpm dev`, trigger magic link login → branded email arrives via Resend
