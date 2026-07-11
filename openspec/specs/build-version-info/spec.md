## Purpose

Build metadata and version display for frontend and backend.

## Requirements

### Requirement: Frontend Build Metadata
The web client build SHALL embed version (from `package.json`), git commit hash, and build datetime, and expose them at runtime.

#### Scenario: Build info available at runtime
- **WHEN** the webapp is built for production
- **THEN** a runtime-accessible object contains `version`, `gitHash`, and `buildTime` (ISO 8601 UTC)

#### Scenario: Colored startup log
- **WHEN** the webapp loads in a browser
- **THEN** the client logs version, git hash, and build time to the console using styled (colored) `console.log` output

### Requirement: Backend Build Metadata
The backend build SHALL embed version (from `Cargo.toml`), git commit hash, and build datetime.

#### Scenario: Version HTTP endpoint
- **WHEN** a client sends `GET /version`
- **THEN** the server responds with JSON containing `version`, `gitHash`, and `buildTime` without requiring authentication

#### Scenario: Colored startup log
- **WHEN** the backend starts successfully
- **THEN** it logs version, git hash, and build time to stdout using colored output

### Requirement: About Dialog Version Display
The web client About dialog SHALL display frontend build metadata and fetch and display backend build metadata from `/version`.

#### Scenario: About shows both sides
- **WHEN** the user opens the About dialog from the hamburger menu
- **THEN** the dialog shows version, git hash, and build time for both the webapp and the backend (or a clear error if the backend version fetch fails)
