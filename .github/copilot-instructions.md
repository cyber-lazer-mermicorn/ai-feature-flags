# Copilot Instructions — AI Feature Flags

## Always
- Read flags through `lib/flags/client.ts`
- Register every new flag in `flags/registry.ts`
- Add a kill switch for every AI feature flag
- Log evaluations with `{ flagKey, value, userId, reason }`
- Use consistent hash for percentage rollouts

## Never
- Read Edge Config directly in components
- Add unregistered flags
- Log PII beyond userId in flag evaluations
