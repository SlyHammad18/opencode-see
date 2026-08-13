# AGENTS.md

## Project

OpenCode plugin `opencode-see`: registers a `describe_image` tool that sends an image (local path or http(s) URL) to a vision LLM and falls back one-at-a-time across **Gemini → Groq → Cerebras** (order configurable). Success comes from the first provider that works; outputs are never merged.

## Commands

- `npm install` — required first; repo has no committed `node_modules`.
- `npm run build` — `tsc -p tsconfig.json`, emits to `dist/` (rootDir `src`). Rebuild after any `src/` change: `dist/` is the shipped artifact (`files: ["dist"]`).
- `npm test` — currently **stale/broken**: points at `dist/test/*.test.js`, but no test directory exists in `src/` or `dist/`. Don't rely on it.

## Layout

- `src/plugin.ts` — entrypoint. Registers the `describe_image` tool; here is where providers are wired in `buildProviderRegistry`. Any new provider must implement `VisionProvider` and be registered here.
- `src/config.ts` — resolves provider order and default prompt (tool arg > `DESCRIBE_IMAGE_PROVIDER_ORDER` > default).
- `src/orchestrator.ts` — the one-at-a-time fallback loop (`describeImageWithFallback`).
- `src/image.ts` — loads local files / URLs into a base64 data URI (mime guessed from extension).
- `src/providers/gemini.ts` — direct Gemini REST call.
- `src/providers/openaiCompatible.ts` — shared `/chat/completions` caller used by `groq.ts` and `cerebras.ts` (thin wrappers).

## Conventions & gotchas

- ESM (`"type": "module"`). Relative imports keep `.js` extensions (e.g. `./image.js`) even though `tsconfig` uses `moduleResolution: "Bundler"`.
- Config comes from opencode.json plugin options (`apiKeys`, `models`, `providerOrder`, `defaultPrompt`) and/or env vars only (no dotenv): `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`; model overrides `*_VISION_MODEL`; `DESCRIBE_IMAGE_PROVIDER_ORDER`; `DESCRIBE_IMAGE_DEFAULT_PROMPT`. Precedence: tool arg > plugin option > env var > default. A provider without its key is skipped, not errored.
- Each provider holds an ordered `models: string[]` list; the orchestrator tries each (provider, model) pair one at a time — see `resolveModels` in `src/config.ts` and the nested loop in `src/orchestrator.ts`.
- Provider failures should throw `ProviderError` (see `src/providers/types.ts`); the orchestrator then moves to the next provider.
- All provider HTTP calls use a 20s timeout via `AbortController` — keep this when adding providers.
- External quirks (see README): Groq rotates vision model ids (set `GROQ_VISION_MODEL` if the default goes stale); Cerebras caps images at 280 tokens.