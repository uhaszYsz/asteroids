# Steam client bridge (optional)

This folder is **only** for Steam desktop builds. It is never required for the browser game.

## Setup

1. AppID is in `steam_appid.txt` (`5069920`).
2. Install bridge deps once:
   ```bash
   cd desktop/steam
   npm install
   ```
3. On the **game server** set:
   ```bash
   STEAM_APP_ID=YOUR_APPID
   STEAM_WEB_API_KEY=YOUR_PUBLISHER_KEY
   ```
   Optional: `STEAM_AUTH_IDENTITY=asteroids-game-server` (must match bridge).

## Run Steam client

Steam client must be running and logged in. Your Steam account must **own** AppID `5069920`
(Steamworks → Packages: add yourself / redeem a test key / install from partner site).
Without ownership, `GetAuthTicketForWebApi` times out.

```bash
npm run desktop:run:steam
```

This:
1. Runs `bridge.js` → writes `session.json` (ticket)
2. Syncs the Neutralino resources **with** Steam boot files
3. Opens the exe

Plain desktop / browser:
```bash
npm run desktop:run    # no Steam files
npm start              # browser — no Steam
```

## Build Steam package

```bash
npm run desktop:build:steam
```

Ship `desktop/dist/asteroids/` plus ensure `steam_api` redistributables from steamworks.js are available next to the process that runs the bridge (see steamworks.js docs). For a store build you will usually wrap bridge+game in one launcher later.
