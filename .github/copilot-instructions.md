<!--
Guidance for AI coding agents working on the FUXA repository.
Keep this short, specific and actionable. Reference files mentioned below when proposing edits.
-->

# FUXA — AI Agent Instructions (concise)

- Purpose: Help an AI become productive fast by describing the architecture, developer workflows, conventions and integration points.

- Quick start (development):
  - Backend: `cd server && npm install && npm start`
  - Frontend (dev): `cd client && npm install && npm start` (Angular dev server)
  - Full debug: use VSCode launch config "Server & Client" (see README)
  - Build frontend for production: `cd client && ng build --configuration=production`
  - Docker: `docker compose up -d` (file: `compose.yml`)

- Big-picture architecture:
  - Backend: Node.js in `server/`. Entrypoint: `server/main.js`. App lifecycle lives in `server/fuxa.js` and `server/runtime`.
  - API layer: `server/api/` modules mount to an Express app; look at `server/api/index.js` for route registration and JWT/auth patterns.
  - Frontend: Angular app in `client/` (root module: `client/src/app/app.module.ts`). Built assets served from `client/dist` by the backend.
  - Electron packaging: `app/` contains packaging logic and Electron entry points.
  - Optional integration: Node-RED integration is mounted conditionally (`server/integrations/node-red`).

- Key operational conventions and patterns (discoverable):
  - Settings: defaults in `server/settings.default.js`; runtime copies/merges into `_appdata/settings.js` when first run. User overrides stored in `_appdata/mysettings.json`.
  - Work directories: `_appdata`, `_db`, `_logs`, `_images`, `_widgets`, `_reports` are created at startup; use `settings.workDir` and `settings.*Dir` values.
  - Logging & events: unified logger in `server/runtime/logger.js`; runtime events emitted via `server/runtime/events.js` and used during init.
  - APIs: authentication via `server/api/jwt-helper.js`; many API modules follow an `init(runtime, authMiddleware, verifyGroups)` pattern and expose `.app()`.
  - Middleware: API rate limiter and bodyParser limits are configured in `server/api/index.js` (`apiMaxLength` setting).
  - Mount strategy: server serves static client build (detects `../client/dist` or `./dist`). When editing routing, update `server/main.js` static mounts.

- Recommended edit patterns for agents:
  - When changing server startup behavior, update `server/main.js` and `server/fuxa.js` together (init → runtime.start → mount APIs).
  - To add an API endpoint, follow existing module structure: new folder under `server/api/`, implement `init()` and `app()` and register in `server/api/index.js`.
  - When modifying authentication, inspect `server/api/jwt-helper.js` and `server/api/apikeys/verify-api-or-token.js` to preserve token and apikey flows.

- Build / CI notes:
  - Electron packaging requires building server + client first (see README section "Creating the Electron Application").
  - Swagger UI is optional and only mounted if `settings.swaggerEnabled`; dependencies `swagger-ui-express` and `yamljs` must be present.

- Files and locations you will frequently reference:
  - server entrypoint: server/main.js
  - app lifecycle: server/fuxa.js
  - API registration: server/api/index.js
  - Angular root: client/src/app/app.module.ts
  - Default settings: server/settings.default.js
  - Docker compose: compose.yml
  - Electron: app/

- Constraints and things NOT to change without human review:
  - Settings merge and secrets handling: avoid leaking `secretCode` or SMTP credentials when returning settings in API responses (`server/api/index.js` strips secrets).
  - Runtime data directories and migrations — changes may affect user data in `_appdata` and `_db`.
  - Authentication/token behaviour — changing token lifetimes or roles impacts clients and API keys.

If anything in these notes is unclear or you need additional examples (test commands, more file pointers, or preferred commit/PR style), ask and I will iterate.
