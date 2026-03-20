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
│  │ (OAuth2/ │ │   Bus    │ │  Abstraction  │   │
│  │  OIDC)   │ │ (Redis)  │ │ (Postgres/    │   │
│  └──────────┘ └──────────┘ │  Redis/...)   │   │
│                             └───────────────┘   │
├────────────┬────────────┬───────────────────────┤
│  Module:   │  Module:   │  Module:              │
│  Messaging │  Project   │  ... (extensible)     │
│  (Slack)   │  Tracking  │                       │
│            │  (Linear)  │                       │
└────────────┴────────────┴───────────────────────┘
         gRPC (inter-module communication)
```

## MVP Modules

| Module | Description | Status |
|--------|-------------|--------|
| **Project Tracking** | Issues, boards, sprints (Linear-like) | In development |
| **Messaging** | Channels, DMs, threads, presence (Slack-like) | In development |

See [docs/modules.md](docs/modules.md) for the full module roadmap.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Rust |
| Async runtime | Tokio |
| HTTP | Axum |
| gRPC | Tonic + Prost |
| Database | PostgreSQL (via SQLx) |
| Cache / Pub/Sub | Redis |
| Auth | JWT (OAuth2/OIDC) |

## Getting Started

### Prerequisites

- Rust 1.92+
- Docker and Docker Compose
- protoc (Protocol Buffers compiler)

### Run locally

```bash
# Start Postgres and Redis
docker compose up -d

# Copy and edit the config
cp openfork.example.toml openfork.toml

# Build and run
cargo run --bin openfork-server
```

The server will start on `http://localhost:8080`.

## Project Structure

```
openfork/
├── core/                   # Auth, storage abstraction, module system, API gateway
├── shared/                 # Common types, errors, utilities
├── proto/                  # Protobuf definitions for gRPC
├── modules/
│   ├── messaging/          # Slack-like module
│   └── project-tracking/   # Linear-like module
├── server/                 # Binary that wires everything together
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
