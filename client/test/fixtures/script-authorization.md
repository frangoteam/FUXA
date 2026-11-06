# HMI script authorization regression (#2615)

Import `script-authorization.fuxap` into an isolated FUXA instance. It contains
only FUXA server memory tags, client internal tags and no external device connections. Enable security and
select Roles authorization.

Create roles with these IDs using the admin-only `POST /api/roles` endpoint
(the IDs, rather than their display names, are stored in permissions):

```json
{"params":[{"id":"role-operator","name":"Operator","index":0},{"id":"role-viewer","name":"Viewer","index":1},{"id":"role-engineer","name":"Engineer","index":2}]}
```

Use the administrator's `x-access-token` header for setup API calls.
Create an administrator (`groups: -1`), an operator with
`info: {"roles":["role-operator"]}` and a viewer with
`info: {"roles":["role-viewer"]}`. Leave the ordinary users' Groups field
unset/null, as when creating users in Roles mode. `info` is a JSON string in
the `POST /api/users` request, for example:

```json
{"params":{"username":"operator","fullname":"Operator","password":"isolated-test-password","groups":null,"info":"{\"roles\":[\"role-operator\"],\"start\":\"v_authorization\"}"}}
```

1. Sign in as the operator. Click **Run SERVER**, then **Run CLIENT**.
   `server-result` and `client-result` must both change from 0 to 42.
   Before the fix both clicks fail in `AuthService.checkPermission` while
   reading `show` from the removed `permissionRoles` field.
2. Click **Different script role**. The button permits the operator, but the
   script requires `role-engineer`: `denied-result` must remain 0. A direct
   `/api/runscript` request for `denied-script` must also be rejected.
3. Sign in as the viewer. The buttons remain visible but disabled; their
   events are removed from the filtered project. Direct requests for either
   server script must be rejected.
4. Sign in as the administrator. Both execution paths must work.
5. Change the operator's role to `role-viewer` and sign in again. Apply the
   viewer expectations. Restore `role-operator` and sign in again to restore
   execution.
6. Switch to Groups authorization; assign Operator (2) and Viewer (1) to the
   respective users. The fixture includes equivalent group permissions.
   Repeat the allow/deny checks; both modes must behave consistently.

The non-admin project response intentionally omits both script permission
fields and server script source. The server filters scripts using its saved
definitions and user cache. `ScriptService` passes `forceUndefined=true` for
this metadata; explicit role restrictions must still be enforced when present.

Automated checks:

```sh
cd client
npm run test:script-authorization
cd ../server
npm run build
npm test -- test/authorization/scriptRoles.test.js
```

The server integration suite uses a temporary user database, real sign-in/JWT
middleware, the user cache and the saved-script runner. Device writes are
confined to an in-memory tag. It also checks forged role/permission/code/name
fields, administrator-only APIs and role changes after sign-in.
