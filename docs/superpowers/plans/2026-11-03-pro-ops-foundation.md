# Data Ops Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in the current session. Preserve 01. No commits or branches are authorized.

**Goal:** Deliver a runnable personal project hub with persistent project management and real HTTP health checks.

**Architecture:** npm workspaces for React, NestJS and shared contracts. PostgreSQL is the deployment database; explicitly selected PGlite supports local development and integration tests because the Docker engine is unavailable. REST and periodic client refresh provide the first monitoring loop.

**Tech Stack:** React, TypeScript, Vite, Tailwind, shadcn/Radix, NestJS, PostgreSQL, node-postgres, PGlite, Docker Compose.

**Spec:** `.oil-ui/project-hub-20261102/DESIGN-BRIEF.md` and the accepted technology proposal.

## Global Constraints

- Preserve the comparison at the root; the application lives in `apps/web`.
- Preserve 01's forest sidebar, warm canvas, lime accents and fonts.
- Seed only metadata; never invent health, resource or deployment data.
- Initial trust boundary: a single-user local workspace, with loopback listeners and published ports; no remote commands.
- Validate HTTP(S) URLs, reject embedded credentials, set timeouts and never follow redirects.
- Failed saves retain input; deletion requires an in-app confirmation.
- Use patch-based edits. No Git initialization, commits or branches.

## Review Focus

- Empty names, malformed IDs, duplicate names and invalid URLs must not change stored data.
- An endpoint or threshold edit invalidates current health but preserves history with its configuration snapshot.
- Refused connections, timeouts and failing HTTP statuses are recorded as failures.
- Repeated checks share in-flight work; deleting/editing during a check never misattributes its result.
- Empty history, disconnected API, narrow screens and failed saves retain a usable UI.

## Task 1: Persistent project API

Files: `packages/shared/src/index.ts`, `apps/api/src/database/*`, `apps/api/src/projects/*`, `apps/api/test/app.test.ts`.

Interfaces: shared ProjectInput/Project/HealthCheck/Activity/Dashboard; GET/POST `/api/projects`, GET/PUT/DELETE `/api/projects/:id`.

- [x] Write and run failing integration assertions for CRUD, duplicates and validation.
- [x] Implement contracts, versioned schema and parameterized queries.
- [x] Verify updates preserve data after reread, deletion cascades and events persist.

## Task 2: Monitoring and activity

Files: `apps/api/src/monitoring/*`, `apps/api/src/app.module.ts`, `apps/api/src/main.ts`, `apps/api/test/app.test.ts`.

Interfaces: POST `/api/projects/:id/check`; GET `/api/projects/:id/checks`, `/api/dashboard`, `/api/activity`, `/api/health`.

- [x] Write failing tests using a controlled local HTTP server.
- [x] Implement bounded requests, schedule, deduplication, history and status transitions.
- [x] Verify success, latency threshold, HTTP errors, timeout, changed endpoint and deletion.
- [x] Run the API suite and type checking.

## Task 3: Fieldwork application

Files: `apps/web/src/*`, `scripts/dev.mjs`. Consumes the shared types and REST APIs.

- [x] Implement dashboard, search/filter, project details and history, forms, monitoring and activity views.
- [x] Include pending/empty/error/loading states and responsive navigation.
- [x] Inspect the actual desktop and narrow viewport.
- [x] Walk create → refresh → edit → check → details → delete and inspect failure behavior.

## Task 4: Deployment, documentation and review

Files: `compose.yaml`, `Dockerfile`, `deploy/nginx.conf`, `README.md`, `docs/architecture.md`.

- [x] Provide PostgreSQL/API/web Compose configuration, persistent storage and loopback publishing.
- [x] Document setup, endpoints, architecture and monitoring boundaries.
- [x] Verify type checking, lint, API tests, builds and browser operation; review final code.

## Execution record

- 2026-11-03: Stack accepted. Work continues in the existing non-Git workspace without further approval gates.
- Docker Linux engine pipe is unavailable; embedded PostgreSQL is an explicit development mode, never a production fallback.
- PUT replaces the complete project configuration, avoiding ambiguous partial defaults across frontend/backend.
- API verification: 21 passing tests across endpoint integration and database lifecycle/persistence suites. Type checking, lint, production builds and Compose structural validation pass.
- Backend/deployment review identified five material issues. Regression cases reproduced stale-version checks, blocked-port false failures, incomplete shutdown draining and unhandled pool errors; fixes pass. Nginx now dynamically resolves the API through Docker DNS; container runtime remains unverified because the engine is unavailable.
- Browser verification includes persisted create/edit/check flows, validation/conflict failures, search/environment/status filtering, mobile navigation/forms at 390 px, offline refresh retaining data, failed saves retaining drafts and successful reconnection. Deletion confirmation was inspected in the UI; test-owned data was removed through the local API.
- Added a real Data Ops project pointing to the local API health endpoint. The six original project records remain unconfigured until their actual endpoints are supplied. Temporary verification projects were removed; historical activities remain as designed.
- Full validation evidence and deployment limitations: `docs/verification/2026-11-03-first-release.md`.
