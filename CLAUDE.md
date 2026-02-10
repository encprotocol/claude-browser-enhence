# Development Workflow

## TDD Rule (mandatory)
Every bug fix and new feature MUST follow this order:
1. **Spot** — identify and describe the issue or requirement
2. **Test** — write a failing test that captures the expected behavior
3. **Fix/Implement** — make the test pass with minimal changes
4. **Verify** — run `npm test` to confirm all tests pass, then verify manually

No code change lands without a corresponding test.

## Commands
- `npm run dev` — dev server (Vite :5173 + Express :3000)
- `npm run build` — production build
- `npm test` — run tests once
- `npm run test:watch` — watch mode

## Test conventions
- Files go in `src/**/__tests__/*.test.ts` (or `.test.tsx`)
- Use vitest globals: `describe`, `it`, `expect`, `vi`, `beforeEach`
- Import from `@/` alias
- Mock xterm.js and WebSocket in component tests (jsdom has no Canvas)
