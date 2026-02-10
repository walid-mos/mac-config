# Plan: Remove Anthropic Provider — OpenAI Only

## Context

The app currently supports two AI providers (OpenAI and Anthropic) for summarization. The user wants to simplify to OpenAI-only for now. Anthropic can be re-added later. This removes the `@anthropic-ai/sdk` dependency, the Anthropic provider class, and simplifies the UI (no more provider selector dropdown).

## Changes

### 1. Delete `src/lib/providers/anthropic-provider.ts` (and its test file)

### 2. Simplify `src/lib/providers/types.ts`
- `AIProvider` type becomes just `"openai"` (or a plain string literal)
- Remove `"anthropic"` from `AI_PROVIDERS` array
- Remove `anthropic` entry from `PROVIDER_CONFIGS`

### 3. Simplify `src/lib/providers/init.ts`
- Remove `AnthropicProvider` import and registration

### 4. Remove `@anthropic-ai/sdk` from `package.json` dependencies

### 5. Simplify `src/components/YoutubeUrlInput.tsx`
- Remove provider dropdown selector — always use OpenAI
- Remove `hasAnthropicKey` prop references
- Always pass `provider: "openai"` to the summarize page

### 6. Simplify `src/components/ApiKeyManager.tsx`
- Only show the OpenAI key card (remove Anthropic card)

### 7. Update `src/pages/api/summarize.ts`
- Remove Anthropic-specific code paths if any

### 8. DB migration: drop the CHECK constraint
- New migration to DROP the `CHECK` constraint on `api_keys.provider` column entirely — provider validation is handled in code, not at DB level

### 9. Update tests
- Remove/update tests referencing Anthropic provider
- Update provider-related test fixtures

### 10. Run `pnpm install` to remove the SDK from lockfile

## Verification
- `pnpm test` — all tests pass
- `pnpm build` — clean build
- `pnpm lint` — no lint errors
- Grep for `anthropic` — no remaining references (except migration history)

## Post-implementation: Test with Docker
After implementation, test locally with Docker (has yt-dlp + ffmpeg):
```bash
docker compose up --build
# Then open http://localhost:4321 and try a video
```
