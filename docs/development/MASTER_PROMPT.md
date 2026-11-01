# Master development prompt

Use this file as the standing instruction for the communication platform. The product decisions live in `docs/architecture/PLATFORM_BLUEPRINT.md`.

The existing Nexora app in `client/` and `server/` is a separate MERN product. Do not replace it, retarget it, or mix its MongoDB and Agora code into this platform.

## How to build

Build one milestone at a time inside `platform/`. Each milestone must run. Do not generate the desktop, mobile, admin, LiveKit, and encryption stacks in the same change.

Before editing, read the files that already exist and extend them. After a change, install, compile, and run the narrowest check that proves the milestone. A compiling API is not proof that two people exchanged a message.

## Current milestone

Milestone 1 and the first messaging slice are in progress under `platform/`.

Done when all of these are true:

1. The API connects to MongoDB.
2. Two accounts can register and log in.
3. Each login creates a device and a rotating refresh session.
4. One user can find the other by username and open a direct conversation.
5. A message is stored in MongoDB before any socket event is treated as delivered.
6. The same `clientMessageId` does not create a second message.
7. A client that reconnects can request messages after the last sequence it has.

## Engineering boundaries

- REST is the durable API. Socket.IO is at-most-once. Persistence plus `sync:request` is what makes delivery reliable.
- MongoDB is the source of truth. Redis is for presence and fanout later, not for the only copy of a message.
- The server stores ciphertext and an encryption header. It does not decrypt private messages and it does not invent a custom cipher. Real device-to-device encryption is a later milestone and must use a reviewed protocol implementation.
- A message accepted by the server is not delivered, and a delivered message is not read. Keep those states separate.
- Authorize every conversation, message, receipt, and socket subscription from membership. A valid access token is not permission to read another conversation.
- Administrators must not get an endpoint that returns private message plaintext.
- Passwords use Argon2id. Refresh tokens are stored only as hashes and rotate on use.
- Secrets stay in `platform/.env`, which is not committed.

## Milestone order

1. Foundation: monorepo, NestJS, Prisma, MongoDB.
2. Identity: email or phone registration, sessions, devices, profiles.
3. Messaging: direct and group chats, receipts, history, reconnect sync.
4. Media and notifications.
5. One-to-one calls, then LiveKit for groups. Do not build an SFU.
6. End-to-end encryption and linked devices.
7. Windows, web, Android, and iOS clients on the same contracts.
8. Admin and moderation without private-message access.
9. Load, recovery, and security tests.

## Frontend

Phase 1 is the web shell in `platform/apps/web`: design tokens, shared controls, and navigation. Authentication screens are the next UI phase. Do not add Electron, React Native, or the admin app in that phase. Do not present a message as sent, or a call as connected, unless the API and a real media session say so.

## Definition of a change

Prefer a small vertical slice over new empty modules. Shared contracts belong in `platform/packages/shared-types`. Do not add Electron, React Native, or a second database until the current milestone's acceptance check passes.
