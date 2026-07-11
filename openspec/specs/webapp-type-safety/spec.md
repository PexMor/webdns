## Purpose

Type safety guarantees for the webapp source and build process.

## Requirements

### Requirement: TypeScript Source
The webapp SHALL be authored entirely in TypeScript: all component files SHALL use the `.tsx` extension and all non-component modules (stores, hooks, utilities) SHALL use the `.ts` extension, with no `.jsx`/`.js` files remaining under `webapp/src/`.

#### Scenario: Source file inventory
- **WHEN** listing files under `webapp/src/`
- **THEN** every file has a `.ts` or `.tsx` extension and none has a `.js` or `.jsx` extension

### Requirement: Build-Time Type Checking
The webapp build SHALL run a TypeScript type-check step and SHALL fail if any type errors are present, so type errors cannot reach a shipped build.

#### Scenario: Build with a type error
- **WHEN** `yarn build` is run against source containing a type error
- **THEN** the build fails before producing output, reporting the type error

#### Scenario: Build with no type errors
- **WHEN** `yarn build` is run against source with no type errors
- **THEN** the build succeeds and produces the same output as the pre-migration JavaScript build
