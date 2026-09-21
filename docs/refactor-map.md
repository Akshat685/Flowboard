# Current JavaScript layout

The existing client/server/shared feature structure remains. UI code uses .jsx; other source, tests, and Vite configuration use .js (Node utility scripts use .mjs).

## Application modules

- Earlier frontend/src/App.jsx is split across client/src/App.jsx, routes, and components/layout/Shell.jsx.
- Earlier frontend/src/api.js is split into services/http.js and feature auth.api.js / boards.api.js.
- Earlier Forms.jsx is split into common/TitleForm.jsx and boards/components/CardForm.jsx / CardComposer.jsx.
- Context providers live in each feature's hooks directory; pages, tests, and styles have dedicated directories.
- Earlier backend routes are split into server/src/modules/auth and boards routes, controllers, services, and validation files.
- User persistence lives in modules/users; embedded columns/cards stay in boards.model.js.
- Shared runtime schemas/constants are imported from the shared workspace directly. Type-only files and compiler configurations were removed.
- Server startup is server/src/server.js; root build produces only client/dist.
- Container files and the separate Compose environment were removed; setup creates only client/.env and server/.env.

## Preserved

REST paths, cookies, ownership checks, limits, optimistic concurrency, live events, drag-and-drop, full-detail card creation, and existing tests remain. The private server/client environments and local MongoDB data were retained. The older ../project/ folder is outside this change.

Review the staged changes with git diff --cached, or compare the current working tree with git diff main.
