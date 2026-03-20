# OpenFork

A modular, self-hostable workspace platform that unifies team tools under a single application with shared identity, security, and storage layers.

## Why OpenFork?

Teams juggle dozens of SaaS tools — Slack, Linear, Notion, and more — each with its own login, data silo, and billing. OpenFork replaces this fragmentation with a single platform where modules communicate natively, share a common identity layer, and let you choose where your data lives.

- **Modular** — each feature (messaging, project tracking, docs, etc.) is an independent module. Enable only what you need.
- **Self-hostable** — run on your own infrastructure with a single binary and Docker Compose.
- **Storage flexibility** — point each module's data at a different backend. Keep sensitive data on-prem while using cloud for the rest.
- **Single identity** — one login, one set of permissions, across all modules.
- **AI-ready** — a unified data layer designed to enable AI capabilities across all your company data (coming soon).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Clients                       │
│            (Web, Desktop, Mobile)               │
└──────────────────┬──────────────────────────────┘
                   │ REST / WebSocket
┌──────────────────▼──────────────────────────────┐
│              API Gateway                        │
│         (Auth, Routing, CORS)                   │
├─────────────────────────────────────────────────┤
│              Core Platform                      │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │   Auth   │ │  Event   │ │   Storage     │   │
│  │  (JWT /  │ │   Bus    │ │  Abstraction  │   │
│  │ Argon2)  │ │ (Redis)  │ │ (Postgres/    │   │
│  └──────────┘ └──────────┘ │  Redis/...)   │   │
│                             └───────────────┘   │
├────────────┬────────────┬───────────────────────┤
│  Module:   │  Module:   │  Module:              │
│  Messaging │  Project   │  ... (extensible)     │
│  (Slack)   │  Tracking  │                       │
│            │  (Linear)  │                       │
└────────────┴────────────┴───────────────────────┘
```

## Modules

| Module | Description | Status |
|--------|-------------|--------|
| **Project Tracking** | Workspaces, projects, issues, labels, comments | MVP complete |
| **Messaging** | Channels, DMs, threads, reactions, WebSocket, presence, full-text search | MVP complete |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Rust |
| Async runtime | Tokio |
| HTTP / WebSocket | Axum 0.8 |
| gRPC | Tonic + Prost |
| Database | PostgreSQL 17 (via SQLx) |
| Cache / Pub/Sub | Redis 7 (via fred) |
| Auth | JWT + Argon2 password hashing |

## Getting Started

### Prerequisites

- Rust 1.92+
- Docker and Docker Compose

### Run locally

```bash
# Start Postgres and Redis
docker compose up -d postgres redis

# Copy and edit the config
cp openfork.example.toml openfork.toml

# Build and run
cargo run --bin openfork-server
```

The server starts on `http://localhost:8080`.

### Run with Docker

```bash
docker compose up -d
```

### Test the API

```bash
# Register a user
curl -s -X POST http://localhost:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","display_name":"Test User","password":"password123"}'

# Login
curl -s -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}'

# Use the access_token for authenticated endpoints
TOKEN="<access_token from above>"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/channels
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh access token |

### Project Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/GET | `/api/workspaces` | Create / list workspaces |
| GET | `/api/workspaces/:id` | Get workspace |
| POST/GET | `/api/projects` | Create / list projects |
| GET/PUT/DELETE | `/api/projects/:id` | Get / update / delete project |
| POST/GET | `/api/projects/:id/issues` | Create / list issues (with filters) |
| GET/PUT/DELETE | `/api/issues/:id` | Get / update / delete issue |
| POST/GET | `/api/issues/:id/comments` | Create / list comments |
| PUT/DELETE | `/api/comments/:id` | Update / delete comment |
| POST/GET | `/api/projects/:id/labels` | Create / list labels |
| PUT | `/api/issues/:id/labels` | Set labels on issue |

### Messaging
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/GET | `/api/channels` | Create / list channels |
| GET/PUT/DELETE | `/api/channels/:id` | Get / update / delete channel |
| POST | `/api/channels/:id/join` | Join channel |
| POST | `/api/channels/:id/leave` | Leave channel |
| POST/GET | `/api/channels/:id/messages` | Send / list messages |
| GET | `/api/messages/:id/thread` | Get thread |
| PUT/DELETE | `/api/messages/:id` | Update / delete message |
| POST | `/api/messages/:id/reactions` | Add reaction |
| DELETE | `/api/messages/:id/reactions/:emoji` | Remove reaction |
| POST/GET | `/api/dm` | Create / list DM groups |
| POST/GET | `/api/dm/:id/messages` | Send / list DMs |
| GET | `/api/messages/search?q=...` | Full-text message search |
| GET | `/api/ws?token=...` | WebSocket connection |
| GET | `/api/presence/:user_id` | Get user presence |

## Project Structure

```
openfork/
├── core/                   # Auth, storage, module system, event bus
├── shared/                 # Common types, errors
├── proto/                  # Protobuf definitions for gRPC
├── migrations/             # All SQL migrations
├── modules/
│   ├── messaging/          # Slack-like module
│   └── project-tracking/   # Linear-like module
├── server/                 # Binary + integration tests
└── docs/                   # Design docs and plans
```

## Per-Module Storage

Each module can use a different storage backend. Configure overrides in `openfork.toml`:

```toml
# Default storage for all modules
[storage.default]
url = "postgres://localhost/openfork"

# Override for a specific module
[modules.messaging.storage]
url = "postgres://other-host/messaging"
```

## License

AGPL-3.0
