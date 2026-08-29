# Architecture

## Flag types

| Type | Use case |
|---|---|
| Boolean | Kill switches, feature on/off |
| String | Model selection (e.g. `gpt-4o` vs `claude-sonnet`) |
| Number | Percentage rollout threshold |
| JSON | Complex targeting rules |

## Evaluation flow
Request → user context → `lib/flags/client.ts` → Edge Config read → targeting rule evaluation → flag value + log.

## Kill switch contract
Every AI-calling feature must check its kill switch before making an LLM call. Kill switch = boolean flag named `<feature>_enabled`. Default = `false` (safe default).
