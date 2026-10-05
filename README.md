# Level 2 — Resource Authentication

The Game Score Tracker API requires authentication for every game and score operation, including reads. Signup, login, and Swagger documentation remain public.

## Run it

```bash
npm install
npm run seed
npm start
npm test
```

Configure the MongoDB connection using `.env` or `config.env` (see `config.env.example`). Swagger UI is available at `http://localhost:4001/api-docs` with the default port. Opening it by IP address instead of `localhost` also works; if you see a CORS error, see the troubleshooting section at the end of [DEBUGGING.md](DEBUGGING.md).

## Authenticate

1. Register with `POST /api/v1/users/signup` using name, email, password, and passwordConfirmation.
2. Send email and password to `POST /api/v1/users/login`.
3. Copy the returned `token` into Swagger's **Authorize** dialog, or send `Authorization: Bearer <token>` on each resource request.

Login returns `token`, `expiresAt`, and the public user profile. Tokens expire after 24 hours by default (`TOKEN_LIFETIME_MINUTES` in `.env`); log in again to obtain a new one. Use HTTPS when hosting the API outside local development.

| Routes | Access |
|---|---|
| POST `/api/v1/users/signup`, POST `/api/v1/users/login` | Public |
| `/api-docs`, `/` | Public documentation |
| GET / POST `/api/v1/games`, `/api/v1/scores` | Authenticated |
| GET / PATCH / DELETE `/api/v1/games/:id`, `/api/v1/scores/:id` | Authenticated |

Missing, malformed, unknown, or expired bearer credentials return 401. Deleted users lose access even if their tokens have not expired. The API guard also covers future resource routers mounted after it.

Authentication does not impose roles or ownership restrictions: authenticated users can operate on any game or score. `submittedBy` and `playerEmail` remain client-supplied fields.

## Browser client (sign up, log in, list games)

`client/` is a plain HTML + `fetch()` page with no build step. Run the API and the client in two terminals:

```bash
npm start          # API     http://localhost:4001
npm run client     # client  http://localhost:5173
```

The client is on a **different origin** from the API (port 5173 vs 4001), so every request is cross-origin. It only works when `CORS_ORIGINS` in `.env` lists the client's origin, and `isAllowedOrigin()` in `middleware/cors.js` allows it. Open DevTools → Network to see the `OPTIONS` preflight the browser sends before requests that carry a JSON body or the `Authorization` header.

Opening the client by IP address (`http://192.168.1.5:5173`) makes it call the API on that same IP, so add that origin to `CORS_ORIGINS` too.

What it deliberately still gets wrong or leaves out:

- The token is kept in a JavaScript variable only, so reloading the page logs you out. It is not in `localStorage`, where an injected script could read it.
- **Log out** only forgets the token in the page. Level 2 has no logout endpoint, so a copied token stays valid until it expires.
- Game fields are shown with `textContent`, never `innerHTML`, because users type them in.

## Interactive guides (open in a browser)

- **[debugging-guide/index.html](debugging-guide/index.html)**: the DEBUGGING.md walkthrough as an interactive page, with real screenshots of Swagger and the browser client, a breakpoint explorer showing the real code under every `● BREAKPOINT`, and exercises. After editing a file that has a breakpoint, run `npm run guide` to refresh its line numbers.
- **[postman-guide/index.html](postman-guide/index.html)**: test the API end to end in Postman, including both ways to send the token (Authorization → Bearer Token with the token only, or a hand-typed `Authorization: Bearer <token>` header) and a token checker. Import `postman-guide/IFT458-Level2.postman_collection.json` to run all 17 requests in one click.

## Debug it step by step

[DEBUGGING.md](DEBUGGING.md) walks through 16 numbered VS Code breakpoints: password hashing and salt at signup, password validation and token creation at login, and how `middleware/authenticate.js` reads and validates the token. `labs/jwt-walkthrough.js` builds and verifies a JWT by hand for comparison. Press F5 with **Debug API server** or **Debug JWT lab** selected.

## Implementation and checks

- `controllers/authController.js` validates bcrypt passwords and issues cryptographically random bearer tokens.
- `models/sessionModel.js` stores SHA-256 token hashes, user references, and expiry timestamps in MongoDB. Raw tokens are never stored.
- `middleware/authenticate.js` validates each request and attaches its user to `req.user`. Expiry is checked on every request independently of MongoDB's TTL cleanup.
- `app.js` mounts authentication before resource routers.
- `SwaggerTFT458.js` documents bearer authentication; `requests.http` includes login and authenticated examples.
- `npm test` checks anonymous rejection across resource operations, authenticated CRUD, invalid and expired credentials, deleted users, password handling, and logging.

Start with `Assignment instructions/START-HERE.md` and the Level 2 student assignment. The folder also includes the non-repudiation and token verification guide, Swagger reference, and Level 1 background materials.
