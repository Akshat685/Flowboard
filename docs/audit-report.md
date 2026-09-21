# Flowboard end-to-end audit and change report

## Scope and outcome

Reviewed the active `flowboard-mern` JavaScript application before modifying it: client/server/shared source, account-owned board workflows, persistence, APIs, authentication, authorization, live events, environment configuration, dependencies, scripts, tests and deployment. Established a passing baseline first.

Preserved explicit login after registration, full-detail card creation, private Atlas configuration, existing IDs/ownership and earlier staged refactor work. No existing users or boards were copied, deleted or edited for testing. Test data lives only in disposable MongoDB instances. The older sibling `project/` application is outside scope. TypeScript and Docker remain absent.

## Problems found and fixed

### Security

1. **P2 — Socket logout race.** A handshake could read the old token version before logout and join the notification room afterward. It could receive later board IDs/activity until expiry, although REST stayed protected. Fixed with a separate revocation room, post-join authentication, a connected-state guard and `session:ready`. A deterministic delayed-query regression verifies revocation.
2. **P2 — Proxy-wide authentication lockout.** Express's default proxy handling grouped clients behind a proxy into one rate-limit bucket. Added validated `TRUST_PROXY` addresses and instructions to overwrite forwarding headers. Tests exhaust one client IP while another still succeeds.
3. **Production configuration gaps.** Added HTTP(S)-only exact origins, required production HTTPS, explicit binding and frontend-serving settings. Boolean/hop-count proxy trust is rejected. Outage responses keep connection details private.

The two P2 findings were independently reproduced by a read-only security review agent. The specialized Security Review tool was unavailable; the fallback was an independent code review, not a proprietary scanner. It found no additional concrete ownership, JWT, CSRF, query-injection or secret-disclosure issue in the examined code.

### Correctness and reliability

4. **Stale card drafts.** Editors previously submitted old fields with the latest live board version. They now retain their starting version, preserve drafts and disable stale saves until the user reviews current data.
5. **Deleted edit target.** Clearing a deleted card's edit selection restores the other cards' drag handles.
6. **Unbounded requests.** Added a 15-second Fetch deadline covering response body parsing. Explicit cancellation remains AbortError. Timeout feedback explains that a write may already have committed.
7. **Session races.** Abort/sequence guards discard obsolete restores, including StrictMode effects. Session revisions prevent old 401 responses clearing a newer sign-in.
8. **Form data loss/duplicates.** Pending guards, disabled fields, local errors and visible whitespace validation prevent accidental edits/duplicate submission during a save. Failed drafts remain intact. Logout also shows a pending state.
9. **Due dates.** Browser testing exposed date input values displayed but not saved. Explicit input-event handling fixes this. An unchanged date preserves its existing timestamp instead of resetting its time.
10. **Live updates and dragging.** Drag layout/version stays fixed until drop/cancel. Superseded reads abort; unrelated board events avoid reloading the selected board. Rejected socket handshakes retry, with cleanup on unmount.
11. **Database outages.** Added bounded readiness ping, disconnected-state guards, connection/socket/query time limits and safe 503 responses. `/api/health` remains liveness; `/api/ready` reflects database availability.

### Performance, UX and operations

12. **Unbounded dashboard reads.** Added owner-scoped pagination, deterministic updatedAt/\_id order, matching index, capped query limits and Previous/Next controls. Pages clamp after deletion.
13. **Production serving.** Express can serve the built app and deep links. Missing API routes/assets remain errors. HTML revalidates, hashed assets cache immutably and private dotfiles are denied. Startup checks for the build.
14. **Navigation and crash recovery.** Added a missing-page view, unavailable-board explanation and React error boundary with reload recovery.
15. **Accessibility/responsiveness.** Added skip navigation, focus target/outline, long-name wrapping, wrapping form feedback and larger touch controls. Removed the external Google Fonts request.
16. **Handoff documentation.** Added architecture/data/auth/API/user-flow diagrams, schema and endpoint descriptions, installation/deployment steps, reverse-proxy example, backup/rollback guidance and isolated browser acceptance instructions.
17. **Verification gaps.** Added tests for all the above timing/concurrency/security cases and made integration tests use the real connection helper.

Implementation checks also found and fixed two temporary regressions: the query deadline was initially placed in unsupported driver connection options, and an HTML fallback under a hidden parent directory failed. The final implementation uses Mongoose's global query setting and root-relative HTML send-file handling.

## Files changed during this audit

Earlier staged refactor changes remain staged and are separate from this inventory. Audit work is left reviewable in the working tree.

- Root: `package.json` adds the smoke command; `README.md` is regenerated.
- Scripts: new `scripts/smoke.mjs`.
- Server configuration: `server/.env.example`, `server/src/config/env.js`, `server/src/config/db.js`; new `server/src/config/environment.schema.js`.
- HTTP/runtime: `server/src/app.js`, `server/src/server.js`, `server/src/routes/index.js`, `server/src/middleware/error.middleware.js`; new `server/src/middleware/client.middleware.js`.
- Auth: `server/src/modules/auth/auth.service.js`.
- Board module: `boards.controller.js`, `boards.service.js`, `boards.model.js`, `boards.validation.js` under `server/src/modules/boards/`.
- Shared: `shared/schemas/boards.js`.
- Client transport/session: `client/src/services/http.js`, `client/src/features/auth/auth.api.js`, `client/src/features/auth/hooks/AuthContext.jsx`.
- Board API/state: `client/src/features/boards/boards.api.js`, `client/src/features/boards/hooks/BoardContext.jsx`.
- Forms/drag: `client/src/components/common/TitleForm.jsx`, `client/src/features/boards/components/CardForm.jsx`, `client/src/features/boards/components/Kanban.jsx`.
- UI/navigation: `client/src/main.jsx`, `client/src/routes/index.jsx`, `client/src/pages/AuthPage.jsx`, `client/src/pages/BoardPage.jsx`, `client/src/pages/BoardsPage.jsx`, `client/src/components/layout/Shell.jsx`, `client/src/styles/global.css`; new `client/src/components/common/ErrorBoundary.jsx` and `client/src/pages/NotFoundPage.jsx`.
- Tests: updated `server/tests/api.test.js`, `client/tests/app.test.jsx`; new `server/tests/deployment.test.js`, `client/tests/resilience.test.jsx`, `client/tests/live-sync.test.jsx`.
- Docs: updated `docs/guide.template.md`, `docs/verification.md`; new `docs/architecture.md`, `docs/deployment.md`, `docs/testing.md`, `docs/audit-report.md`.

## Dependencies

No dependency upgrades or additional runtime packages were required. The installed lockfile baseline reported zero known npm audit vulnerabilities. Existing tools support these changes. Avoiding unrelated major upgrades keeps this audit reviewable. JavaScript syntax, lint and runtime validation are used; TypeScript checking is intentionally not applicable.

## Verification results

Baseline: **19 passing tests**. Final suite: **37 passing tests** (1 shared, 13 server/deployment, 23 client), with no failures or skips.

- `npm run check`: passed Node syntax checks and ESLint.
- `npm run format:check`: passed.
- `npm test`: all 37 tests passed.
- `npm run build`: passed, 83 modules; main JavaScript 416.31 kB, 130.51 kB gzip.
- `npm audit --json`: zero known vulnerabilities across the installed dependency tree.
- `npm ls --depth=0`: all required workspace packages resolve, with no missing/invalid entries.
- `git diff --check`: passed. No TypeScript/TSX, Docker or Compose source/configuration files found in active source.
- Development readiness: both direct API 4001 and Vite proxy 5173 returned 200 with `status: ready` against the configured database. This was a ping only, not a real-record CRUD test.
- `npm run guide`: generated the 4,595-line source guide; two consecutive generations produced identical SHA-256 hashes.
- `npm ls typescript typescript-eslint tsx tsc-alias --all`: empty, as intended. This command returns exit code 1 when none of the queried packages are installed.
- Normal development servers remain running on 5173/4001; a fresh browser load shows the login form. The separate browser-test server and its child processes were stopped after acceptance.

Browser acceptance used the built app served by Express and an isolated database. Observed successful registration confirmation followed by explicit sign-in; board and full card creation; persisted metadata and date editing; a second tab showing saved data; live column creation; stale editor preserving fields and blocking save; menu movement; keyboard lift/arrow/drop saving into Done; desktop and 360-pixel viewport without page-wide horizontal overflow; no console errors during the exercised flow; and logout returning both tabs to login. Date entry failed on the first pass and passed after the input fix. Automated tests cover destructive CRUD, failed authentication, ownership isolation and error cases without editing real records.

## Remaining limits and recommendations

- This is local verification, not unconditional production certification. Hosted CI, public HTTPS/DNS/proxy, monitoring, backup restoration, sustained load, multiple instances and comprehensive screen-reader/cross-browser/device tests remain release-environment checks.
- Use one Node instance initially. Multiple instances require shared limiter storage, a Socket.IO adapter and distributed revocation; simply adding instances changes the guarantees.
- Password recovery, email verification, account deletion, team roles, uploads, billing/calculations and history/trash are not current app features. No unrelated product features were added. Evaluate account recovery/verification before public self-service registration.
- Rotate the database credential previously shared in conversation through Atlas and update the private server environment before public release. No credential is reproduced here or changed automatically.
- Existing databases can retain the old board-list index. Have a DBA assess it before removal; this audit does not drop indexes or migrate user documents.
- Deletion is permanent and network timeouts can leave write results ambiguous. Backups and refreshing before retrying remain necessary.
- Browser acceptance is documented manual verification, not a committed cross-browser CI suite.

Supporting material: [architecture](architecture.md), [deployment](deployment.md), [testing](testing.md), [verification](verification.md), [complete source guide](../README.md).
