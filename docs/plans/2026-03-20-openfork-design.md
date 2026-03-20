# OpenFork — Platform Design

**Date:** 2026-03-20
**Status:** Validated

---

## 1. Overview

OpenFork is a modular, self-hostable workspace platform that unifies team tools (messaging, project tracking, docs, etc.) under a single application with shared identity, security, and storage layers.

### Core Principles

- **Modular by design** — each feature is a plugin module conforming to a core trait interface. Modules are separate Cargo crates, independently compilable.
- **Storage flexibility** — each module declares what storage it needs (relational, cache, blob). The core provides adapters for different backends. A deployment can point different modules at different providers.
- **Single identity** — the core is an OAuth2/OIDC identity provider. Modules never handle authentication — they validate tokens from the core. External SSO integrates as an identity source.
- **Dual API surface** — REST (JSON) for external clients (web, desktop, mobile), gRPC (protobuf) for internal module-to-module communication.
- **Start small, grow modularly** — MVP ships with project tracking and messaging. The architecture supports adding modules without changing the core.

### Target Audience

Initial: small-to-mid teams (5–500). Architecture designed so enterprise features (audit logs, compliance, advanced RBAC) can be layered on later.

---

## 2. Architecture

### Core Platform Components

- **Plugin registry** — discovers and loads modules at startup. Each module implements a `Module` trait (lifecycle hooks: init, migrate, shutdown).
- **API gateway** — routes incoming REST requests to the right module. Handles rate limiting, request validation, CORS.
- **Auth service** — issues/validates JWTs, manages users, sessions, refresh tokens. OAuth2/OIDC flows. Email/password for MVP, SSO-ready.
- **Storage abstraction** — traits (`RelationalStore`, `CacheStore`) with default implementations (Postgres, Redis). Modules receive their configured store at init.
- **Event bus** — Redis Pub/Sub. Modules can publish and subscribe to events. Powers real-time updates via WebSocket connections managed by the core.
- **gRPC service bus** — modules register gRPC services. Inter-module calls go through this bus.

### Request Flows

**External (client → module):**
```
Client → REST API Gateway → Auth middleware (JWT validation)
  → Route to module handler → Module uses storage/event abstractions
  → Response back through gateway
```

**Inter-module:**
```
Module A → gRPC service bus → Module B handler → Response
```

**Real-time:**
```
Module publishes event → Redis Pub/Sub → Core WebSocket manager
  → Push to connected clients with matching subscriptions
```

---

## 3. Module System

Each module is a Cargo crate that implements the core `Module` trait.

### Module Trait

```rust
trait Module: Send + Sync {
    fn name(&self) -> &str;
    fn version(&self) -> Version;

    // Lifecycle
    fn init(&self, ctx: ModuleContext) -> Result<()>;
    fn shutdown(&self) -> Result<()>;

    // Declare what this module needs
    fn storage_requirements(&self) -> StorageRequirements;
    fn rest_routes(&self) -> Vec<Route>;
    fn grpc_services(&self) -> Vec<GrpcService>;
    fn event_subscriptions(&self) -> Vec<EventSubscription>;
}
```

### ModuleContext

Provided by the core at init:
- Configured storage backends (already connected)
- Event bus handle (publish/subscribe)
- gRPC client to call other modules
- Auth utilities (validate tokens, get current user)

### Key Rules

- **Storage isolation:** modules cannot access each other's storage directly. All inter-module communication goes through gRPC or events.
- **Declarative storage:** a module says "I need a relational store and a cache store." The core reads deployment config to decide which adapter to provide.
- **Static registration:** the `server` crate wires modules at compile time (no dynamic loading for MVP).

---

## 4. MVP Modules

### Project Tracking (Linear-like)

**Entities:** Workspace, Project, Issue, Label, Comment.

Issues have: status (backlog, todo, in-progress, done, cancelled), priority, assignee, labels. Issues belong to a project, projects to a workspace.

**MVP features:**
- CRUD for projects and issues
- Board view (Kanban by status) and list view
- Filtering and sorting (by status, priority, assignee, label)
- Comments on issues with mentions

**Storage needs:** relational store only.

### Messaging (Slack-like)

**Entities:** Channel, DirectMessage, Message, Thread, Reaction.

Channels can be public or private. Messages support threads and reactions.

**MVP features:**
- Channels (create, join, leave, archive)
- Direct messages (1:1 and group)
- Threaded replies
- Reactions
- Presence (online/offline/away)
- Message search

**Storage needs:** relational store + cache store (presence, typing indicators, active connections). Heavy use of event bus and WebSocket layer.

---

## 5. Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Rust (stable) |
| Async runtime | Tokio |
| HTTP framework | Axum |
| gRPC | Tonic + Prost |
| Database | PostgreSQL via SQLx (compile-time checked, no ORM) |
| Cache / Pub/Sub | Redis (via fred or deadpool-redis) |
| WebSockets | Axum built-in (tokio-tungstenite) |
| Auth | jsonwebtoken (JWT) |
| Serialization | serde / serde_json |
| Migrations | sqlx-cli (per-module migration folders) |
| IDs | uuid |
| Testing | cargo test + testcontainers-rs |
| Protobuf | protoc + prost (build dependency) |

---

## 6. Project Structure

```
openfork/
├── Cargo.toml              # workspace root
├── core/                   # auth, storage abstraction, plugin system, API gateway
├── proto/                  # protobuf definitions for gRPC
├── shared/                 # common types, error handling, utilities
├── modules/
│   ├── messaging/          # Slack-like module
│   └── project-tracking/   # Linear-like module
├── server/                 # binary that wires everything together
├── docs/
│   ├── modules.md
│   └── plans/
└── docker-compose.yml
```

---

## 7. Configuration & Deployment

### Configuration

Hierarchical, loaded at startup:
1. Default values (compiled in)
2. Config file (`openfork.toml`)
3. Environment variables (override config file)

```toml
[server]
host = "0.0.0.0"
port = 8080

[auth]
jwt_secret = "..."
token_expiry = "15m"
refresh_expiry = "7d"

[storage.default]
type = "postgres"
url = "postgres://localhost/openfork"

[storage.cache]
type = "redis"
url = "redis://localhost:6379"

# Per-module storage overrides
[modules.messaging.storage]
type = "postgres"
url = "postgres://other-host/messaging"

[modules.project-tracking.storage]
# omitted = uses default
```

Per-module hosting: one config section override to point a module's data at a different backend.

### Deployment (MVP)

- Single binary (`openfork-server`) with all modules compiled in
- Docker image + `docker-compose.yml` (server + Postgres + Redis)
- No orchestration for MVP — single binary + Docker Compose
