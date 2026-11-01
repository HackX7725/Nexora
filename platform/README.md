# Communication platform

TypeScript API for private and group messaging. This folder is separate from the Nexora MERN app in `client/` and `server/`.

The standing build rules are in `docs/development/MASTER_PROMPT.md`.

## Run the API

Accounts, sessions, and messages are stored in MongoDB. Use the existing Atlas cluster and the `nexora_platform` database so this app does not share collections with the older app.

```bash
cd platform
pnpm install
pnpm --filter @platform/api db:push
pnpm dev:api
```

The API listens on port 4000. Health check: `GET http://localhost:4000/api/v1/health`.

## Run the web shell

```bash
cd platform
pnpm dev:web
```

The shell is at `http://localhost:3000`. Sign-in checks the password, then emails a 6-digit code to the account address. Saved contacts can open a direct chat or a voice call. Account creation uses the API at `http://localhost:4000`. Set `SMTP_USER` and `SMTP_PASS` in `platform/.env` before expecting that email.

Register two users, create a direct conversation, and send a message with a stable `clientMessageId`. Repeating that id returns the original message. `GET /api/v1/conversations/:id/messages?after=0` returns anything missed while a client was offline.

Redis is reserved for presence fanout. Message history is stored in MongoDB.
