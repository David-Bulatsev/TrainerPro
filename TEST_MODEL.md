# Test Model

## Critical user scenarios

1. Coach login, session restore after refresh, and logout.
2. Role-based access to protected pages and write operations.
3. Athlete CRUD with filters, sorting, and pagination.
4. File upload, listing, and deletion for athlete or injury records.
5. Dashboard loading with weather integration in both success and failure modes.

## Business rules and constraints

- Authentication requires a valid email/password pair and returns a bearer token.
- New users receive the default `user` role and read-only style permissions.
- Protected endpoints must return `401` for invalid tokens and `403` for insufficient permissions.
- Athlete and injury identifiers must exist before files can be attached.
- Files are restricted by extension and maximum size.
- External weather integration must respect timeout, retry, and rate-limit rules.

## High-risk areas

- Authentication and session restoration through `localStorage`.
- RBAC enforcement across UI and FastAPI endpoints.
- Object storage flows and metadata consistency when upload or delete fails.
- Third-party API failures, empty responses, and configuration gaps.

## Test strategy

- `unit`: pure helpers, service logic, and isolated UI state.
- `integration`: FastAPI endpoints with test DB and mocked storage/API adapters.
- `e2e`: browser scenarios with mocked backend responses and route interception.

## Quality gates

- Backend coverage target: 75% on touched backend modules.
- Frontend coverage target: 70% on touched frontend modules.
- Fast suites: `unit` and most `integration`.
- Slow suites: `e2e` and tests marked `slow`.
