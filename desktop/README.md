# Desktop shell (Neutralino + WebView2)

Wraps the browser client in a small Windows `.exe` that uses the system WebView2 engine (not bundled Chromium).

## Prerequisites

- Node.js 18+
- Windows with WebView2 (usually preinstalled)
- Game server running for multiplayer: `npm start`

## Commands (from repo root)

```bash
npm run desktop:run          # non-Steam exe (PIN / guest accounts)
npm run desktop:build        # non-Steam package → desktop/dist/
npm run desktop:run:steam    # Steam ticket → Steam-synced exe
npm run desktop:build:steam  # Steam package
npm run desktop:sync         # copy HTML/JS/assets only (no Steam)
```

## Server URL

Desktop uses `desktop/config.client.js` (copied to `resources/config.js`).

Default: `https://szkodnik.com/asteroids`

For local-only testing, temporarily set `http://127.0.0.1:8765` in that file.

## Steam vs browser

| Build | Steam code |
|---|---|
| Browser (`npm start`) | None — `game.js` only acts if `window.__ASTEROIDS_STEAM__` exists |
| `desktop:run` | No Steam boot files |
| `desktop:run:steam` | Uses `desktop/steam/` only |

Steam setup details: see `steam/README.md`.

## Steam depot

```bash
npm run desktop:pack:steam
```

Upload the whole folder `desktop/dist/steam-depot/` via SteamPipe.

Steamworks → Installation → Launch Options:
- Executable: `AsteroidsArena.bat`
- Working Directory: (blank)

`AsteroidsArena.bat` fetches a fresh Steam ticket each launch, then starts the game exe.
