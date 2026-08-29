# AI Feature Flags — Agent Doctrine

## What this repo is
AI-powered feature flag system: model-based targeting, gradual rollouts, A/B testing for AI features, kill switches.
By Cherry Shanaley (Chan), AI Solutions Engineer.

## Tech stack
- TypeScript strict, Next.js 15, Vercel Edge Config (fast reads), Supabase (flag storage)

## Coding rules
- Flag reads go through `lib/flags/client.ts` — never read Edge Config directly in components
- Flag definitions in `flags/registry.ts` with typed `Flag<T>` interface
- Targeting rules are typed `TargetingRule[]` — never freeform strings
- Kill switches: every AI feature must have a corresponding boolean kill switch flag
- Flag evaluation logged with `{ flagKey, value, userId, reason }` — no PII beyond userId
- Gradual rollouts use percentage-based targeting — consistent hash of userId

## Commands
```bash
npm install && npm run dev
npm run flags:validate  # validate all flag definitions
npm run test
```
