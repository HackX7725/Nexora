# Communication platform blueprint

Independent of the Nexora MERN app. Implementation lives in `platform/` and follows `docs/development/MASTER_PROMPT.md`.

The product is a privacy-first messaging system for Windows, the browser, Android, and iOS. One NestJS API owns accounts, conversations, and message durability. Clients share TypeScript contracts. Voice and video come later through WebRTC signaling, with LiveKit only for group calls.

## Stack

| Area | Choice |
| --- | --- |
| Language | TypeScript |
| API | NestJS on Node.js |
| Primary data | PostgreSQL and Prisma |
| Temporary state | Redis, after the durable path works |
| Jobs | BullMQ, when media and push need it |
| Realtime | Socket.IO with application acknowledgements |
| Web and admin | Next.js |
| Windows | Electron with a sandboxed renderer and a preload bridge |
| Mobile | React Native and Expo |
| Files | S3-compatible storage, MinIO locally |
| Group media | LiveKit |
| One-to-one media | WebRTC, with STUN and TURN |

Python is not part of the core messaging path.

## Backend modules

Auth, users, devices, sessions, contacts, conversations, messages, receipts, realtime, presence, media, calls, encryption, notifications, status, reports, and admin.

REST changes durable records. Sockets announce events. PostgreSQL stores records. Redis stores presence and cross-instance routing. Object storage stores bytes. The server never treats a socket send as proof of delivery.

## Data model

Core tables: `users`, `user_profiles`, `devices`, `sessions`, `conversations`, `conversation_members`, `messages`, `message_receipts`, `outbox_events`, and `user_blocks`.

Required constraints:

- Unique email, phone, and username when present.
- Unique membership `(conversation_id, user_id)`.
- Unique `(sender_device_id, client_message_id)` so retries do not duplicate a message.
- Unique `(conversation_id, sequence_number)`.
- Unique `(message_id, device_id)` receipts.
- One direct conversation per pair, stored as a sorted `direct_key`.

Message lifecycle: accepted on the server, delivered to a device, then read. Those are different facts.

## Realtime contract

Version 1 events: `message:send`, `message:accepted`, `message:new`, `message:delivered`, `message:read`, `typing:start`, `typing:stop`, `presence:update`, `sync:request`, `sync:complete`.

The client generates `clientMessageId` before the first attempt and reuses it after a timeout. The server assigns `sequenceNumber`.

## Security

- HTTPS and WSS in deployment.
- Argon2id password hashes.
- Short-lived access tokens and rotating refresh tokens.
- A session check on every authenticated request so logout takes effect immediately.
- Membership checks on every conversation read and write.
- Ciphertext is opaque to the API. End-to-end encryption is a later milestone and must use a maintained Signal-style library per platform, with one cryptographic identity per device.
- Admin tools must not expose decrypted private chats. Moderation uses reports and account metadata.
- Electron renderers stay sandboxed, with context isolation and no direct Node access.

## API surface for the first slice

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create an account with email or phone |
| POST | `/api/v1/auth/login` | Open a device session |
| POST | `/api/v1/auth/refresh` | Rotate the refresh token |
| POST | `/api/v1/auth/logout` | Revoke the current session |
| POST | `/api/v1/auth/logout-all` | Revoke every session |
| GET | `/api/v1/auth/sessions` | List sessions |
| GET | `/api/v1/users/me` | Current profile |
| PATCH | `/api/v1/users/me` | Update the display name |
| GET | `/api/v1/users/search` | Find people by username |
| POST | `/api/v1/users/:id/block` | Block |
| DELETE | `/api/v1/users/:id/block` | Unblock |
| POST | `/api/v1/conversations` | Open a direct chat or create a group |
| GET | `/api/v1/conversations` | List chats |
| GET | `/api/v1/conversations/:id/messages` | History after a sequence |
| POST | `/api/v1/conversations/:id/messages` | Accept a message |
| POST | `/api/v1/messages/:id/delivered` | Delivery receipt |
| POST | `/api/v1/messages/:id/read` | Read receipt |

Sending a message returns `accepted` and a sequence number. That response does not mean the other person has the message.

## Later milestones

Media upload URLs, push notifications, call signaling, LiveKit tokens, device key bundles, disappearing messages, status posts, and the admin console. Clients come after two API users can send a message, disconnect, and recover it.
