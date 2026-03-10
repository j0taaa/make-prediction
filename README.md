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

## Checks

```bash
bun run lint
bunx tsc --noEmit
bun run build
```
