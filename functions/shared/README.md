# Financial engine

`functions/shared/` is the portable financial engine used locally by both the SPA and Firebase
Functions. It has no Firebase, Vue, browser-state, workspace, or network dependencies.

## Dependency direction

```text
core
├── assets
├── liabilities
├── income
├── expenses
└── positions
    ├── plan
    └── progress
```

Lower-level domains must not import `plan` or application adapters. Imports should name the
specific module rather than use a global barrel, keeping dependencies and frontend bundles clear.

## Naming contract

- `normalize…` validates or canonicalizes input and may return `null`.
- `calculate…` returns a financial result from explicit inputs.
- `build…Schedule` returns an ordered series of dated calculations.
- `…FromBalance` starts at a balance known on the projection date.
- `…FromAnchor` replays contractual events after an observed historical anchor.
- `…Valuation` is a calculated asset value; `balance` is a recorded or reconstructed liability.
- `…Projection` estimates future evolution; `…Scenario` compares assumptions.

Similar calculations remain separate when their financial meaning differs. In particular,
`buildFrenchMortgageScheduleFromBalance` projects forward from today's known balance, while
`calculateMortgageBalanceFromAnchor` reconstructs a balance by replaying payments after a dated
observation. Combining them would hide a material difference in their inputs and time semantics.

Modules in `src/domain/financial/` and `functions/features/` remain only when they translate
application document shapes, orchestrate several rules, or persist feature state. New financial
rules belong here and should expose documented, domain-specific names; consumers import them
directly from their domain module without compatibility facades or global barrels.
