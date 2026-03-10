# Secret Prediction Vault

Create a timestamped proof token for a hidden prediction, then reveal the text later and verify that it matches.

## Local (Bun)

```bash
bun install
bun run dev
```

## Docker Compose

```bash
docker compose up --build
```

Open http://localhost:3000

## PWA support

The app now includes a web manifest and service worker so it can be installed as a Progressive Web App.

- In Chromium-based browsers, use **Install app** from the address bar/menu.
- The app shell and previously visited pages are cached for offline reuse.

## Checks

```bash
bun run lint
bunx tsc --noEmit
bun run build
```
