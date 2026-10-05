# Debugging Level 2 in VS Code — follow a password and a token through the code

You will pause the running API at 16 numbered breakpoints and watch, line by line:

1. **Signup** — how a plain password becomes a salted bcrypt hash (breakpoints 1–5)
2. **Login** — how the password is checked and a token is born (breakpoints 6–11)
3. **Using the token** — how the middleware reads the token and proves this server issued it (breakpoints 12–16)

Then a separate lab shows how a **JWT** is built and verified, for comparison.

> Prefer clicking through it? Open **[debugging-guide/index.html](debugging-guide/index.html)** in a browser: the same walkthrough with real screenshots and a breakpoint explorer.

## Setup (once)

1. Open the project folder itself in VS Code (**File → Open Folder…**), not its parent — `.vscode/launch.json` must be at the top.
2. `npm install`, then `npm run seed` if your instructor asks for sample data.
3. Stop any `npm start` already running (port 4001 can only be used once).
4. Open **Run and Debug** (`Ctrl+Shift+D` / `Cmd+Shift+D`), choose **Debug API server**, press **F5**. Wait for `DB connection successful`.
5. Open `http://localhost:4001/api-docs`.

## How to set a breakpoint

Search the project for `● BREAKPOINT` (`Ctrl+Shift+F` / `Cmd+Shift+F`). Each comment block says what to do. Click in the gutter **left of the line number of the first code line under the block** — a red dot appears.

| Key | Does |
|---|---|
| F5 | Continue to the next breakpoint |
| F10 | Step over — run this line, stop on the next |
| F11 | Step into — follow a function call into its file |
| Shift+F5 | Stop debugging |

While paused: **VARIABLES** shows local values, hovering a variable shows its value, and the **DEBUG CONSOLE** evaluates any expression in the paused code (the comments give you expressions to try).

## The breakpoints

| # | File | What you see |
|---|---|---|
| 1 | `controllers/authController.js` | signup request: `req.body.password` is plain text |
| 2 | `models/userModel.js` | pre-save hook, before hashing |
| 3 | `models/userModel.js` | the random **salt**, e.g. `$2b$12$YbMg6f5k7xWd1sYQAHC7kO` |
| 4 | `models/userModel.js` | the 60-character hash — it starts with the salt |
| 5 | `controllers/authController.js` | the response contains no password |
| 6–7 | `controllers/authController.js` | login: the stored hash is loaded with `.select('+password')` |
| 8 | `authController.js` → `userModel.js` | `bcrypt.compare` re-uses the salt stored in the hash |
| 9 | `controllers/authController.js` | the token is **born**: 32 random bytes |
| 10 | `controllers/authController.js` | its lifetime: `TOKEN_LIFETIME_MINUTES` from `.env` |
| 11 | `controllers/authController.js` | only the token's SHA-256 is stored in `sessions` |
| 12 | `middleware/authenticate.js` | the `Authorization: Bearer …` header is read |
| 13 | `middleware/authenticate.js` | the presented token is hashed |
| 14 | `middleware/authenticate.js` | the session lookup: *did we issue it, and is it still alive?* |
| 15 | `middleware/authenticate.js` | `req.user` is attached, `next()` hands over |
| 16 | `controllers/gameController.js` | the controller runs — authentication, but no authorization |

Trigger journeys 1–2 with **POST /users/signup** and **POST /users/login** in Swagger. For journey 3, copy the token, click **Authorize**, paste it, then run **GET /games**.

## Route and controller breakpoints (R, G, S)

Breakpoints 1–16 follow the password and the token. The lettered breakpoints below cover every **route** and every **controller** action, so you can pause any request Swagger can send.

A line such as `router.post('/login', ...)` runs **once, when the server starts**, to build the route table. A breakpoint on that line never fires for a request. That is why each route file has a small pass-through function (`router.use` and `router.param`) that does nothing except call `next()`. Its only job is to give you a line that runs on every request.

| # | File | Trigger | What you see |
|---|---|---|---|
| R1 | `routes/userRoutes.js` | signup or login | `req.baseUrl` vs `req.path`: the `/api/v1/users` prefix is already stripped |
| R2 | `routes/gameRoutes.js` | any `/games` request | `req.user` is already set, because authenticate ran first |
| R3 | `routes/gameRoutes.js` | `/games/{id}` | the `id` pulled from the URL; try `abc` |
| R4 | `routes/scoreRoutes.js` | any `/scores` request | same as R2, for scores |
| R5 | `routes/scoreRoutes.js` | `/scores/{id}` | same as R3, for scores |
| G1 | `controllers/gameController.js` | GET /games/{id} | found, or `null` → 404 |
| G2 | `controllers/gameController.js` | POST /games | `pick()` drops fields that aren't allow-listed (mass assignment) |
| G3 | `controllers/gameController.js` | PATCH /games/{id} | any user can edit any game; `runValidators` |
| G4 | `controllers/gameController.js` | DELETE /games/{id} | 204 with no body; a second DELETE → 404 |
| S1 | `controllers/scoreController.js` | GET /scores | `sort('-points')`, no filtering by user |
| S2 | `controllers/scoreController.js` | GET /scores/{id} | `req.params.id` from R5 |
| S3 | `controllers/scoreController.js` | POST /scores | `req.user.email` vs the `playerEmail` typed in the body |
| S4 | `controllers/scoreController.js` | PATCH /scores/{id} | any player can mark a score `verified` |
| S5 | `controllers/scoreController.js` | DELETE /scores/{id} | nothing compares the caller with the score's owner |

For `GET /games/{id}`, the full order is **12 → 13 → 14 → 15 → R2 → R3 → G1**. `authenticate` comes first because app.js mounts it before the games router. Set all of them and press F5 at each stop to confirm the order. The **CALL STACK** panel shows Express handing the request from one function to the next.

## Salt, cost and `.env`

- The **salt** is 22 random characters generated for *every* password (breakpoint 3). It is stored inside the hash, is not secret, and is **not** in `.env`.
- `BCRYPT_ROUNDS` in `.env` is the **cost**: `12` means 2¹² rounds. It is stored in the hash too (`$2b$12$…`).
- A single secret added to every password is called a **pepper**. This project does not use one.

## Life of the token

| Stage | Where | Breakpoint |
|---|---|---|
| Birth | login creates a random token, stores its SHA-256 and `expiresAt` | 9–11 |
| Use | every request re-hashes the token and finds the session | 12–15 |
| Expiry | `expiresAt` has passed → the middleware returns 401 immediately | 14 |
| Cleanup | MongoDB's TTL index deletes the expired session (about once a minute) | — |
| Early logout | **not possible in this build** — there is no logout endpoint | — |

To watch a token die: set `TOKEN_LIFETIME_MINUTES=1` in `.env`, restart the debugger, log in, wait a minute, call **GET /games** again, and stop at breakpoint 14.

## See your token in the browser's developer tools

Open DevTools with **F12** (**Cmd+Option+I** on a Mac). The first place works in both Swagger and the browser client; the second only in the client.

### 1. Network tab (Swagger and the client)

1. Open the **Network** tab *before* you log in, and filter by **Fetch/XHR**.
2. Log in. Click the **`login`** request and open **Response** (or **Preview**): you see `"token": "…64 hex characters…"`.
3. Load games. Click the **`games`** request and open **Headers → Request Headers**: you see `Authorization: Bearer <token>`.

Step 3 shows the same token travelling back to the server on every request.

In the browser client you may also see an **`OPTIONS`** request just before a request. That is the CORS *preflight*: the browser sends one before any cross-origin request that carries an `Authorization` header or a JSON body. The preflight never carries the token. The browser remembers a successful preflight for 10 minutes (`maxAge` in `middleware/cors.js`), so it does not appear every time. Swagger never shows one, because it is on the same origin as the API.

### 2. Console (browser client only)

The client keeps the token in a top-level variable. On `http://localhost:5173`, type this in the **Console** tab:

```js
session
```

After you log in, it shows `{ token, expiresAt, user }`. Reload the page and type it again: it shows `null`. The token lived only in memory, so the reload removed it.

### Where you will NOT find it

Look under **Application → Local Storage** and **Session Storage**. Neither the client nor this Swagger saves the token there (Swagger uses `persistAuthorization: false`), so no other script, and no later user of a shared lab computer, can pick it up from disk.

Anyone who copies the token from the Network tab can use it until it expires, even after you click **Log out**. Level 2 has no logout endpoint, so treat the token like a password and cover it in screenshots.

## JWT lab

The API uses opaque tokens, not JWTs. `labs/jwt-walkthrough.js` builds a JWT by hand so you can compare. Choose **Debug JWT lab** in Run and Debug and press F5. Breakpoints **J1–J6** show the header, the claims, the HMAC-SHA256 signature made with `JWT_SECRET` from `.env`, and verification. The lab then tampers with the payload, uses a wrong secret, and waits for expiry — each is rejected.

Never paste `JWT_SECRET` or a real application token into a website.

## Exercises — answer each with a file, a line and a value

1. Sign up two users with the same password. At breakpoint 3, record both salts. Are the hashes equal? Why not?
2. At breakpoint 8, run `bcrypt.getSalt(this.password)` in the Debug Console. Where did you see this value before?
3. Log in and record the token (cover it in screenshots). In Compass/Atlas, find its session. Which field matches the value from breakpoint 11, and why isn't the token itself stored?
4. Change one character of the token in Swagger's Authorize box and call GET /games. At which breakpoint and line is the request rejected, and what is `session`?
5. With `TOKEN_LIFETIME_MINUTES=1`, show the same token accepted and then rejected. Which condition in which line changed its answer?
6. As one user, delete a game created by another user. Which breakpoint shows the request was *authenticated*? Which line would have to change to make it *authorized*?
7. Set R1–R5, G1–G4 and S1–S5, then send one request of every kind in Swagger. For each request, list the breakpoints it stopped at, in order.
8. At S3, submit a score with someone else's `playerEmail`. Write the one line that would make the server use `req.user` instead, and say why `userId` is `null` today.
9. In the JWT lab, what does the server need in order to trust a JWT, compared with what it needs to trust this API's opaque token?

## Troubleshooting: CORS error when opening Swagger by IP address

**Symptom:** Swagger works at `http://localhost:4001/api-docs`, but at `http://<your-ip>:4001/api-docs` every **Try it out** fails. The browser console shows a CORS error, and the server log shows no request at all.

**Why it happened:** an *origin* is scheme + host + port. `http://localhost:4001` and `http://192.168.1.5:4001` are the same machine but **different origins**. Earlier versions of `SwaggerTFT458.js` hard-coded the server address as `http://localhost:4001/api/v1`. A page loaded from the IP address therefore sent its requests to `localhost` — a cross-origin request. The API sends no CORS headers, so the browser blocked the response.

CORS is enforced by the **browser**, not the server. That is why the same request works from `requests.http` or `curl` but fails in Swagger.

**The fix (already in this project):** the Swagger `servers` entry is the relative path `/api/v1`. Requests now go to whichever host served the page, so `localhost` and the IP address both work with no CORS setup.

**To check it:** restart the server, reload `http://<your-ip>:4001/api-docs`, and confirm the **Servers** dropdown shows `/api/v1`.

Keeping Swagger and the API on the same origin is better than adding the `cors` package, which would open the API to other origins you never meant to allow. A separate front end (for example, a React app on another port) *is* a real cross-origin case: that needs the `cors` package with an explicit allowlist of origins.
