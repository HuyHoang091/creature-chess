# Auth0 Setup

This project uses Auth0 in 3 places:

- `apps/web-game` for SPA login
- `apps/server-info` to authenticate the current user
- `apps/server-game` to authenticate socket handshakes for registered players

To make Auth0 work end-to-end, you need:

- 1 Auth0 tenant
- 1 Single Page Application
- 1 Machine to Machine Application
- 1 custom API audience

## 1. Create a custom API

In Auth0, create an API for this project.

Recommended values:

- Name: `Creature Chess API`
- Identifier: `https://creature-chess-api`
- Signing Algorithm: `RS256`

Save the API identifier into:

- `AUTH0_API_AUDIENCE=https://creature-chess-api`

This is important because the frontend requests an access token for this API and the backend verifies that audience.

## 2. Create the SPA application

Create a `Single Page Application`.

Copy its client ID into:

- `AUTH0_SPA_CLIENT_ID`

Use these Auth0 application settings for local dev:

- Allowed Callback URLs:
  - `http://localhost:8090`
  - `http://127.0.0.1:8090`
- Allowed Logout URLs:
  - `http://localhost:8090`
  - `http://127.0.0.1:8090`
- Allowed Web Origins:
  - `http://localhost:8090`
  - `http://127.0.0.1:8090`
- Allowed Origins (CORS):
  - `http://localhost:8090`
  - `http://127.0.0.1:8090`

For production, also add your real domains, for example:

- `https://covuasinhvat.xyz`
- `https://www.covuasinhvat.xyz`

## 3. Create the Machine to Machine application

Create a `Machine to Machine Application`.

Authorize it to call:

- `Auth0 Management API`

Grant at least the permission needed to read users:

- `read:users`

Copy these values into:

- `AUTH0_MACHINE_TO_MACHINE_CLIENT_ID`
- `AUTH0_MANAGEMENT_CLIENT_SECRET`

## 4. Environment variables

Set these in your `.env`:

```env
AUTH0_ENABLED=true
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_SPA_CLIENT_ID=your_spa_client_id
AUTH0_API_AUDIENCE=https://creature-chess-api
AUTH0_MACHINE_TO_MACHINE_CLIENT_ID=your_m2m_client_id
AUTH0_MANAGEMENT_CLIENT_SECRET=your_m2m_client_secret

CREATURE_CHESS_APP_URL=http://localhost:8090
API_INFO_URL=http://localhost:8090/api
GAME_SERVER_URL=http://localhost:8090/game
CREATURE_CHESS_IMAGE_URL=http://localhost:8090/images
```

## 5. Database behavior

When a user logs in with Auth0 for the first time:

- backend verifies the JWT
- backend reads the Auth0 user `sub`
- if no local DB user exists for that `sub`, it creates one
- if nickname/profile is missing, the app sends the player to `Complete Profile`

## 6. Start the project

Run:

```powershell
yarn start-server-info
yarn start-server-game
yarn dev-web-game
```

Or:

```powershell
yarn dev-all
```

## 7. Expected result

When Auth0 is configured correctly:

- landing page shows `Sign In`
- login redirects to Auth0
- after login, the frontend requests `/user/current`
- a first-time user sees `Complete Profile`
- a registered user lands in `Home Hub`
- game socket can authenticate with `type: "auth0"`

## 8. Common failure cases

### `Sign In` button does not appear

Check:

- `AUTH0_ENABLED=true`
- frontend dev server restarted after env change

### Login succeeds but `/user/current` fails

Check:

- `AUTH0_API_AUDIENCE` is set
- the Auth0 API identifier matches exactly
- backend has the same `AUTH0_DOMAIN`

### JWT verification fails

Check:

- API signing algorithm is `RS256`
- `AUTH0_DOMAIN` has no protocol prefix
  Example:
  - correct: `my-tenant.us.auth0.com`
  - wrong: `https://my-tenant.us.auth0.com`

### Socket login works for guest only

Check:

- account login actually completed
- frontend has a valid access token
- `AUTH0_API_AUDIENCE` is configured
- `server-game` is running with the same Auth0 env values
