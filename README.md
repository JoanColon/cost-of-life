# Cost of Life

## Front-end structure

The application uses explicit Vue Router routes. The complete URL map is in
`src/router/routes.js`; page filenames do not generate routes automatically.

```text
src/
├── layouts/       Shared application shells such as the authenticated drawer
├── pages/         One clearly named file for every visible page
├── components/    Reusable UI used by pages
├── stores/        Pinia application state
├── services/      Authentication and Firebase data access
├── utils/         Pure calculations and formatting helpers
└── router/        Route definitions and authentication guards
```

Navigation should use named routes, for example:

```js
router.push({
  name: 'assets',
  params: { workspaceId },
})
```

Do not recreate filename-based routing or build workspace URLs manually.

## Project purpose

Cost of Life is the active project.

All implementation work must happen inside this project unless explicitly instructed otherwise.

The repository may contain code copied from other projects under `/references`. That code exists only so Codex can understand existing patterns, architecture, utilities, calculations, Firebase setup, UI approaches, or implementation decisions.

---

# IMPORTANT: Reference folders are READ-ONLY

Everything inside:

- `/references/financial-crimes`
- `/references/fireplanner`
- any other folder under `/references`

must be treated as **READ-ONLY reference material**.

## Do not modify reference code

Codex must NEVER:

- edit files inside `/references`
- delete files inside `/references`
- rename files inside `/references`
- move files inside `/references`
- refactor code inside `/references`
- run automatic migrations over `/references`
- apply formatting changes to `/references`
- update dependencies inside reference projects
- modify configs from reference projects
- commit changes intended for reference projects

The original projects are independent applications and must not be altered indirectly through these copies.

If a task appears to require changing reference code, stop and implement the equivalent change inside Cost of Life instead.

---

# How reference code should be used

Reference projects may be inspected to understand:

- application architecture
- Vue / Quasar patterns
- TypeScript patterns
- Firebase configuration
- Firebase Authentication
- Firestore usage
- Firebase Functions
- composables
- Pinia stores
- reusable utilities
- Capacitor integrations
- Android-specific configuration patterns
- API wrappers
- validation logic
- financial calculations
- UI/UX patterns
- error handling
- logging
- deployment patterns

Reference code is a source of implementation ideas, not shared production code.

When useful, reproduce or adapt the relevant logic inside the active Cost of Life codebase.

Do not create imports from `/references`.

Example of what NOT to do:

```ts
import { something } from '../references/financial-crimes/...'
```
