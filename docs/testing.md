# Testing and acceptance

## Repeatable commands

Run from `flowboard-mern/` using Node 24:

```sh
npm ci
npm run check
npm run format:check
npm test
npm run build
npm audit
npm run guide
```

`check` runs Node syntax checks for server/shared/scripts and ESLint for JavaScript/JSX. There is intentionally no TypeScript type-check command. `test` runs shared, server and client workspaces. Server tests launch a disposable MongoDB process, set a random test JWT secret and override all database settings before app initialization. They never use private Atlas records. The first run may download MongoDB from the upstream distribution; CI pins 7.0.24.

The source guide is generated from `docs/guide.template.md` and current files. Edit the template, then run `npm run guide`. CI checks that regeneration does not change committed README contents. Never hand-edit embedded README snippets.

## Automated coverage

- Shared: Unicode password byte limits match Node UTF-8 behavior.
- Server: registration without auto-login, safe public user projection, duplicate email, incorrect passwords, login cookie, session restoration, logout revocation, expiry.
- Authorization: user ownership, inaccessible/malformed IDs, every CRUD route, cross-board moves, strict payloads and owner injection attempts.
- Persistence: board/column/card create/read/update/delete, array order, metadata, atomic moves, stale/simultaneous edits, bounded documents and paginated summaries.
- Request security: CSRF protection header, exact-origin CORS/preflight, malformed JSON, error handling and IP-based authentication limits behind a trusted proxy.
- Sockets: invalid cookies, private rooms, notifications, expiry and logout racing with an already-started authentication query.
- Deployment: HTTPS/proxy environment validation, database readiness failures, actual database connection helper, SPA deep links, static asset caching, private-file denial and API 404 behavior.
- Client: loading/session restore, form errors, registration/login flow, create-board UI, full card creation/cancel/retry, move menu, keyboard drag/cancel, stale edit protection, pagination, request timeout/cancellation, old-session 401 responses, StrictMode restoration races, pending form locks, unchanged due timestamps, error boundary and socket reconnect cleanup.

## Isolated browser acceptance

```sh
npm run smoke
```

Open `http://127.0.0.1:4002/register`. This builds the app, serves it through Express, and creates a fresh temporary MongoDB database. It overrides `MONGODB_URI` and uses a new random JWT secret. Use invented test credentials only. `127.0.0.1` also keeps the smoke cookie separate from the normal development site's `localhost` cookie. Ctrl+C closes HTTP/sockets/database and removes the temporary database. `SMOKE_PORT` can select another port.

Acceptance checklist:

1. Register a test account. Confirm the success message is on the login page, then sign in explicitly. Check wrong password and duplicate email errors.
2. Create a board, rename it and change its description. Reload its direct URL.
3. Create/rename a column. Cancel a deletion confirmation. Validate whitespace-only input.
4. Open Add card and enter title, description, priority, date and labels. Cancel one draft; submit another. Reload and verify every field.
5. Edit a card. Move it using the menu and keyboard drag: Space, arrow keys, Space. Escape cancels a drag.
6. Open the same board in a second tab. Save a change in one tab and confirm it appears in the other. Keep an edit open during a second-tab change; confirm the draft survives and stale save is disabled.
7. Delete only disposable test cards/columns/boards and confirm they stay deleted after refresh.
8. Sign out everywhere and confirm both tabs lose protected access. Navigate directly to the old board URL.
9. Check unknown page and missing-board feedback. Inspect browser console and phone/desktop layouts, focus visibility, skip link and horizontal Kanban scrolling.
10. Stop the test server. Confirm the normal Atlas-backed development environment remains available.

The browser checks are recorded in the audit report; they are not a committed browser automation suite. Automated integration tests cover destructive CRUD and ownership without modifying real data.

## Release limits

Passing this suite is evidence for the tested behaviors, not a claim of zero possible bugs. Hosted CI, real HTTPS/reverse-proxy operation, multiple Node instances, screen-reader testing, cross-browser/device coverage, sustained load and backup restoration require separate release-environment checks. Password recovery and email verification are not implemented in this private-board app; evaluate them before opening public self-service registration.
