# Agent Instructions

Use red-green-refactor TDD for development in this repository.

## Workflow

1. Red: write or update a focused failing test that captures the intended behavior.
2. Green: implement the smallest production change that makes the test pass.
3. Refactor: improve the design while keeping the full test suite green.

## Expectations

- Do not implement behavior before there is a failing or newly relevant test for it.
- Keep tests close to the behavior being changed and prefer high-signal unit tests for core primitives.
- Run the relevant test file first, then the broader suite before finishing.
- Preserve existing behavior unless the test change intentionally documents a new contract.
- Keep implementation changes scoped to the behavior under test.

For this project, prefer:

```sh
vp test
vp exec vitest run --coverage
vp exec tsc --noEmit
vp build
```

