# Flowboard: JavaScript MERN application and guide

Flowboard uses MongoDB, Express, React, and Node.js. Application source, shared validation, configuration, and tests are plain JavaScript; React components use JSX. The existing feature/module organization and npm workspaces remain in place. All code below is generated from the working files.

Your private Atlas connection remains in `server/.env`. Existing local records were not copied, as requested. The separate older `../project/` application and retained local database are outside this change.

Start with [architecture and diagrams](docs/architecture.md), [installation and deployment](docs/deployment.md), [testing instructions](docs/testing.md), and the [end-to-end audit report](docs/audit-report.md).

## 1. Project overview

A Flowboard is a Kanban task manager: boards contain workflow columns, and columns contain task cards. This app supports accounts, private boards, full column/card CRUD, card metadata, drag-and-drop, and live updates between the owner's sessions.

React sends requests to `/api` through Vite on port 5173. Express listens on port 4001 and talks to MongoDB using Mongoose. Socket.IO sends account-scoped notifications; clients reload the authoritative data through REST. MongoDB credentials never reach the browser.

The older application in `../project/` contains additional workspace, sprint, comment, and role features. Those are not implemented by this core Flowboard app and are not silently removed from the older project.

## 2. Folder structure

```text
flowboard-mern/
  client/
    public/                 favicon.ico, robots.txt
    src/
      components/           common forms, application layout, UI extension directory
      features/
        auth/               auth.api.js, hooks, index.js
        boards/             boards.api.js, hooks, card forms, Kanban, index.js
      pages/                auth, boards, board details and missing-page views
      routes/               ProtectedRoute.jsx, index.jsx
      services/http.js      Fetch transport and API errors
      store/index.jsx       Context provider composition
      styles/global.css
      utils/errors.js
      App.jsx
      main.jsx
    tests/                  app, card creation, resilience, live sync and setup
    .env                    private client configuration
    .env.example
    index.html
    package.json
    vite.config.js
  server/
    src/
      modules/
        auth/               routes, controller, service, validation
        boards/             routes, controller, service, model, validation
        users/              model and public-user projection
      config/               db.js, env.js, environment.schema.js
      middleware/           auth, errors, authentication rate limiting
      errors/AppError.js
      routes/index.js
      app.js
      server.js
    scripts/dev.mjs
    tests/                  api.test.js, deployment.test.js
    .env                    private database and session configuration
    .env.example
    package.json
  shared/
    constants/              card priorities
    schemas/                auth, board, column, card, move and version validation
    tests/auth.test.js
    package.json
  scripts/                  setup, source checks, guide generation, isolated smoke server
  docs/                     architecture, deployment, testing, audit, guide and migration map
  .github/workflows/ci.yml
  eslint.config.js
  .prettierrc
  .prettierignore
  .gitignore
  package.json
  package-lock.json
  README.md
```

Dependencies, client build output, private environment files, and `.local/` are ignored by Git. Empty extension directories are reserved for future functionality. There are no invented products/orders modules or separate card collections.

See [the file migration map](docs/refactor-map.md) for how the files were reorganized.

## 3. Stack and workspaces

- **MongoDB:** durable users and boards collections. Columns and cards stay embedded in their board, preserving atomic moves and array order.
- **Mongoose:** schema validation, timestamps, ownership references, indexes, and optimistic concurrency.
- **Express and Node.js:** REST routing, request validation, authentication, persistence, and live notifications. The server runs directly from JavaScript source.
- **React, React Router, Context:** views, protected pages, session restoration, and board state.
- **Fetch:** JSON transport with cookies, request-protection headers, and readable errors.
- **Zod:** shared runtime validation; it remains necessary in JavaScript.
- **bcryptjs and jsonwebtoken:** password hashing and signed session cookies.
- **Socket.IO:** private live updates and logout disconnections.
- **@hello-pangea/dnd:** card drag-and-drop, with a keyboard-accessible Move to alternative.
- **Vite, Vitest, Testing Library, Node test runner, ESLint, Prettier:** development, build, verification, and formatting.

Install once at the repository root. The workspaces link `@flowboard/shared` directly to its JavaScript schemas/constants. There is no server/shared compilation step. Client `@/` and `@shared` aliases are configured in Vite; Node modules use native ESM imports with explicit file extensions.

{{file:package.json}}

{{file:client/package.json}}

{{file:server/package.json}}

{{file:shared/package.json}}

## 4. Backend setup and middleware

After `npm ci` and `npm run setup`, set the server environment and run `npm run dev`. Startup connects to MongoDB and initializes indexes before listening. Shutdown closes live connections and the database connection.

Middleware applies Helmet, the exact allowed browser origin, JSON size limits, cookies, and write-request protection. Writes must send JSON and `X-Flowboard-Request: 1`. The cookie policy is HttpOnly/SameSite=Lax, with Secure cookies under HTTPS in production.

{{file:server/src/config/env.js}}

{{file:server/src/config/environment.schema.js}}

{{file:server/src/config/db.js}}

{{file:server/src/app.js}}

{{file:server/src/server.js}}

{{file:server/src/routes/index.js}}

{{file:server/src/errors/AppError.js}}

{{file:server/src/middleware/error.middleware.js}}

{{file:server/src/middleware/rateLimit.middleware.js}}

{{file:server/src/middleware/client.middleware.js}}

{{file:server/scripts/dev.mjs}}

## 5. Database and shared validation

Users contain name, normalized unique email, password hash, and a token version for account-wide logout. Public responses expose only ID, name, and email.

Boards contain owner, title, description, ordered columns, and a version number. Cards contain title, description, priority, optional due date, labels, and timestamps. Limits remain 30 columns and 500 cards per board; at most 10 labels per card, each at most 32 characters. Passwords must fit the original 72 UTF-8 byte bound.

Each mutation checks the client's board version. Mongoose optimistic concurrency detects simultaneous saves; stale writes return 409. A card move removes and inserts within one board save, preserving its ID and metadata atomically.

{{file:server/src/modules/users/users.model.js}}

{{file:server/src/modules/users/users.service.js}}

{{file:server/src/modules/boards/boards.model.js}}

{{file:shared/constants/boards.js}}

{{file:shared/constants/index.js}}

{{file:shared/schemas/auth.js}}

{{file:shared/schemas/boards.js}}

{{file:shared/schemas/common.js}}

{{file:shared/schemas/index.js}}

## 6. Authentication

Registration validates inputs, hashes the password, and creates a user without starting a session. The client then shows the login page with an account-created confirmation. Login verifies the password and sets the signed cookie; it uses a dummy hash for missing accounts to avoid skipping password work. Protected routes verify the token's algorithm, issuer, audience, expiry, and token version before loading the account.

Logout increments tokenVersion and disconnects that account's sockets. The client never stores the JWT in localStorage. Ownership checks are required in addition to authentication: another account's board returns 404.

{{file:server/src/middleware/auth.middleware.js}}

{{file:server/src/modules/auth/auth.controller.js}}

{{file:server/src/modules/auth/auth.routes.js}}

{{file:server/src/modules/auth/auth.service.js}}

{{file:server/src/modules/auth/auth.validation.js}}

## 7. Frontend setup, routes, and layout

Vite proxies both `/api` and `/socket.io` to Express. Run the browser at `http://localhost:5173` to match the configured origin. The application restores the session before rendering protected pages and provides retry controls when the API is unreachable.

{{file:client/index.html}}

{{file:client/vite.config.js}}

{{file:client/src/main.jsx}}

{{file:client/src/components/common/ErrorBoundary.jsx}}

{{file:client/src/pages/NotFoundPage.jsx}}

{{file:client/src/App.jsx}}

{{file:client/src/store/index.jsx}}

{{file:client/src/routes/ProtectedRoute.jsx}}

{{file:client/src/routes/index.jsx}}

{{file:client/src/components/common/TitleForm.jsx}}

{{file:client/src/components/layout/Shell.jsx}}

{{file:client/src/pages/AuthPage.jsx}}

{{file:client/src/pages/BoardPage.jsx}}

{{file:client/src/pages/BoardsPage.jsx}}

{{file:client/src/styles/global.css}}

## 8. State management

Auth Context handles the account, restoration state, login, registration, logout, and unauthorized events. Board Context tracks the list, selected board, pending writes, errors, and live connection state.

Only one local mutation runs at a time. After writes, including conflicts or ambiguous network errors, the state reloads from REST. Sequence guards prevent older responses replacing newer selections. Socket events, window focus, and a periodic fallback refresh recover missed changes.

Superseded reads are cancelled. Requests have a 15-second deadline. Session revisions prevent old 401 responses from clearing a newer login. Open card edits retain their starting version; stale drafts stay visible but cannot overwrite newer data. Drag layouts stay fixed until drop/cancel. The dashboard uses bounded pagination.

{{file:client/src/features/auth/hooks/AuthContext.jsx}}

{{file:client/src/features/boards/hooks/BoardContext.jsx}}

## 9. CRUD, card details, drag-and-drop, and live updates

Routes delegate HTTP concerns to controllers; services perform database operations. Every nested board operation first resolves a board owned by the signed-in user. Column/card schemas and operations remain within the boards module.

**Add card opens the same full-detail form used by editing:** title, description, priority, due date, and labels. Cancel creates nothing. Failed saves preserve the draft. The native drag button keeps its drag attributes while saving so keyboard focus can be restored. A Move to menu provides an alternative to dragging.

{{file:server/src/modules/boards/boards.routes.js}}

{{file:server/src/modules/boards/boards.controller.js}}

{{file:server/src/modules/boards/boards.service.js}}

{{file:server/src/modules/boards/boards.validation.js}}

{{file:client/src/features/boards/components/CardComposer.jsx}}

{{file:client/src/features/boards/components/CardForm.jsx}}

{{file:client/src/features/boards/components/Kanban.jsx}}

## 10. API integration and errors

All paths below are under `/api`:

- POST `/auth/register`, POST `/auth/login`, GET `/auth/me`, POST `/auth/logout`.
- GET `/health` for liveness; GET `/ready` for database readiness (503 during an outage).
- GET/POST `/boards`; GET/PATCH/DELETE `/boards/:boardId`.
- GET/POST `/boards/:boardId/columns`; GET/PATCH/DELETE `/boards/:boardId/columns/:columnId`.
- GET/POST `/boards/:boardId/columns/:columnId/cards`; GET/PATCH/DELETE that path plus `/:cardId`.
- POST `/boards/:boardId/cards/:cardId/move` with source column, target column, target index, and version.

Writes to existing boards require `version: board.__v`. Board creation and nested creates return 201. Deleting a board and logout return 204. Other successful reads and updates return 200.

The board list accepts `page` (default 1) and `limit` (default 24, maximum 100), returning `{ boards, page, pages, total }`. Summaries exclude columns. See [the API contract](docs/architecture.md#api-contract).

The transport sends cookies and protection headers, handles empty 204 responses, preserves cancellation, and emits unauthorized events when a protected request returns 401. Components display loading, saving, and error states rather than discarding failed drafts.

{{file:client/src/services/http.js}}

{{file:client/src/utils/errors.js}}

{{file:client/src/features/auth/auth.api.js}}

{{file:client/src/features/auth/index.js}}

{{file:client/src/features/boards/boards.api.js}}

{{file:client/src/features/boards/index.js}}

## 11. Environment variables

{{file:server/.env.example}}

{{file:client/.env.example}}

- Server `MONGODB_URI`: private MongoDB connection string. This project uses that name, not DATABASE_URL. Your Atlas database remains configured in the private file.
- Server `JWT_SECRET`: random secret, at least 48 characters. Setup generates it only when creating a new environment file.
- Server `CLIENT_ORIGIN`: exact origin with no trailing slash; default http://localhost:5173.
- Server `PORT`: default 4001.
- Server `HOST`: default 127.0.0.1; production binding depends on the host network.
- Server `TRUST_PROXY`: empty by default; allow only the real proxy IP/CIDR or local `loopback`.
- Server `SERVE_CLIENT`: defaults to true in production, false otherwise. Requires a client build when enabled.
- Server `NODE_ENV`: development/test/production; production cookies require HTTPS.
- Client `VITE_API_URL`: public API base, normally /api.
- Client `API_PROXY_TARGET`: development proxy target, normally http://127.0.0.1:4001.

Never put database credentials or session secrets in VITE_* variables. Restart the server after changing its environment; client build-time variables require a new build.

## 12. Install, run, and deploy

Use Node.js 24 or a compatible version at least 22.12. MongoDB must be reachable: use your configured Atlas database, or an installed local MongoDB service and its URI.

```powershell
cd 'C:\Akshat\bolt flowboard\Flowboard2\flowboard-mern'
npm.cmd ci
npm.cmd run setup
npm.cmd run dev
```

Open http://localhost:5173/register. The API health endpoint is http://localhost:4001/api/health. Keep the development process running; Ctrl+C stops both services. Restart with the same `npm run dev` command. Do not launch a second copy on occupied ports.

Setup preserves the existing client/server environment files. Your local database copy remains in `.local/mongodb`; this app uses the URI configured in `server/.env`. Earlier accounts and board IDs were not transferred to Atlas, as requested.

{{file:scripts/setup.mjs}}

For separate terminals, run `npm run dev -w server` and `npm run dev -w client`. Shared schemas are consumed directly from JavaScript; the server watcher watches them too.

```powershell
npm.cmd run check
npm.cmd run format:check
npm.cmd test
npm.cmd run build
npm.cmd start
```

`build` creates `client/dist`. `start` launches Node directly from `server/src/server.js`; there is no server build output. In production Express serves the built client and SPA deep links by default. Put an HTTPS reverse proxy in front with WebSocket upgrades and an explicit proxy allowlist. See [deployment and nginx instructions](docs/deployment.md). Vite preview is not a production API proxy.

For multi-instance deployments, use a shared rate-limit store and Socket.IO adapter, configure trusted proxies deliberately, and test backups and restores before launch.

For isolated browser acceptance, run `npm run smoke` and use `http://127.0.0.1:4002/register`. This creates a temporary MongoDB database and never copies Atlas data. Stop with Ctrl+C.

{{file:scripts/smoke.mjs}}

## 13. Verification, CI, and source checks

See [the verification record](docs/verification.md) and [complete audit report](docs/audit-report.md) for reviewed issues, fixes, test results and remaining deployment limits.

Tests use a disposable local MongoDB process and mock browser requests; they do not write to the configured Atlas database. The first server test run may download a MongoDB executable. CI runs the same checks, formatting, tests, build, and guide-regeneration verification.

{{file:scripts/check.mjs}}

{{file:.github/workflows/ci.yml}}

{{file:eslint.config.js}}

{{file:.prettierrc}}

{{file:.prettierignore}}

{{file:.gitignore}}

{{file:shared/tests/auth.test.js}}

{{file:server/tests/api.test.js}}

{{file:server/tests/deployment.test.js}}

{{file:client/tests/app.test.jsx}}

{{file:client/tests/card-create.test.jsx}}

{{file:client/tests/resilience.test.jsx}}

{{file:client/tests/live-sync.test.jsx}}

{{file:client/tests/setup.js}}

Manual acceptance: create an account, confirm that the login page appears, then sign in explicitly. Create a board and full-detail card; reload to check persistence; edit and move a card; check a second tab receives updates; sign out everywhere and confirm both tabs lose access. Use `git diff main` to review the current changes.

## 14. Common errors and conversion notes

- **Connection refused:** start `npm run dev`, then check API health. A browser page alone does not start the API.
- **Port occupied:** close the earlier app process before starting another. Avoid stopping unrelated Node processes.
- **MongoDB connection fails:** check the URI, database user/password, Atlas IP allowlist, network, or local database service. Encode special characters in URI credentials.
- **401 or JWT expiry:** sign in again. Tokens last one hour; changing the secret or signing out everywhere invalidates sessions.
- **403/CORS:** use the exact CLIENT_ORIGIN, send the request protection header, and keep credentials enabled. localhost and 127.0.0.1 are distinct origins.
- **400/413/415:** correct invalid input, excessive payloads, or missing JSON Content-Type.
- **409:** reload the current board before retrying. Inspect whether a failed network response already saved a create operation.
- **429:** authentication attempts are throttled; wait before retrying.
- **Blank page or broken imports:** install at the root, then run check, tests, and build. Use the new .js/.jsx paths.
- **Live updates reconnecting:** check /socket.io proxying, cookies, session expiry, and WebSocket upgrades.
- **Production login fails:** Secure cookies require HTTPS and matching origin configuration.

For any later migration of the older application, first map existing entities, IDs, account/password formats, and permissions. Preserve workspace memberships and original IDs deliberately, or maintain an explicit ID mapping. Migrate into a separate database, verify counts/references and authorization behavior, then switch traffic with a rollback plan. No such data migration runs automatically in this project.
