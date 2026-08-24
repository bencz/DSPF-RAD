# 04 Seed-Data Backend (Spring Boot Demo Server)

## 1. Purpose

The generated React app needs screen data to show effects. Real IBM i backends are usually unavailable, and reference applications often lack data. The seed backend fills this gap:

```text
seed definitions (JSON) + optional values extracted from RPG/RPGLE sources
    ↓
Spring Boot seed server
    ↓ HTTP /api
generated React app renders realistic screens
```

The normative endpoint and schema contract is `contract/openapi.yaml`. This document explains ownership and limits.

## 2. Hard boundary: demo, not production

The seed server is a demo fixture server. It must never impersonate a production backend:

- Every response includes `"mode": "seed-demo"` so the client can label the UI.
- No session, CSRF, authentication, authorization, idempotency, or audit enforcement. These remain deferred (decision D-11). If a future production runtime is built, it starts from `openapi.yaml`, not from this server's code.
- No business authority. A submitted transaction replays scripted seed transitions; it computes nothing real.
- No secrets in seed files, logs, or generated output.
- CORS allows local development origins only.

## 3. Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Liveness; returns `{ "status": "ok", "mode": "seed-demo" }` |
| `/api/screens/{screenName}` | GET | Seeded screen state for one screen revision |
| `/api/transaction` | POST | Submit AID + field payload; return the next seeded screen state |

Error contract: `400` invalid shape, `404` unknown screen, `409` unknown screen revision in request, `422` field validation against seed metadata, `500` unexpected. Every error body carries `code`, `message`, and optional `details`.

## 4. Screen state shape

`GET /api/screens/{screenName}` returns the OpenAPI `ScreenState`:

```json
{
  "mode": "seed-demo",
  "screen": "WCUSTSD2",
  "revision": "R1",
  "modelKey": "24x80",
  "record": "ZZCT01",
  "fields": [
    { "runtimeBindingKey": "ZZCT01.SFLC", "domId": "Z-XMG3tX", "value": " 1", "usage": "O", "readOnly": true }
  ],
  "messages": [],
  "actions": [{ "id": "F3", "kind": "aid", "enabled": true }],
  "subfiles": { "ZZSF01": { "rows": [], "page": 12 } },
  "cursor": { "field": null, "row": null, "col": null }
}
```

Field entries use the same identity rules as the mapping contract (`runtimeBindingKey`, `domId`). Values are strings padded to source length where known.

## 5. Transaction behavior

`POST /api/transaction` receives `{ screen, screenRevision, aid, fields, cursor?, subfiles? }` and responds with the OpenAPI `TransactionResponse` (`screen`, `screenRevision`, `messages`, `fieldValues`, `indicators`, `cursor`, `subfiles`, `nextActions`).

Behavior is scripted, deterministic, and derived from seed transition tables:

```text
IF a seed transition matches (current screen, AID, guard):
    respond with the target screen state
ELSE IF validation fails against seed metadata:
    422 with per-field errors
ELSE:
    stay on the current screen with an informational message
```

Repeated identical requests return identical responses.

## 6. Seed sources

### 6.1 Hand-written seeds

One JSON file per screen under `src/main/resources/seeds/<screen>.json`, containing initial state plus transitions. Seeds carry the `sourceRevision` of the Mapping Contract that produced them.

### 6.2 Extracted seeds from reference RPG/RPGLE (optional)

When `INPUT/` reference programs contain display logic, extract seed material through the runtime binding adapter:

```text
read external runtime source
identify the display file and record references
resolve a qualified DSPF field identity
classify the runtime role
capture source location and value/hint
emit seed fragments + traceability
```

Runtime roles:

| Role | Seed result | Rule |
|---|---|---|
| `display-value` | Initial field value | Require source identity |
| `hidden-control` | Hidden binding value | Never render as a visible input |
| `indicator` | Indicator preset | Preserve polarity and location |
| `message` | Message entry | Preserve severity |
| `workflow-hint` | EXFMT/WRITE transition candidate | Becomes a seed transition only after review |
| `unknown` | Manual review item | Never generates executable behavior |

Statuses follow the conversion-core rule (`converted` … `error`). Unresolved statements become review items; they never silently disappear. Extraction does not execute external code and does not migrate business logic — decision D-14.

## 7. Generated project template

```text
spring-seed-server/
├── pom.xml
├── src/main/java/com/example/seed/
│   ├── SeedApplication.java
│   ├── api/
│   │   ├── HealthController.java
│   │   ├── ScreenController.java
│   │   ├── TransactionController.java
│   │   └── ErrorResponse.java
│   ├── seed/
│   │   ├── SeedRepository.java        loads resources/seeds/*.json
│   │   ├── TransitionResolver.java    matches AID + guards
│   │   └── FieldValidator.java        validates against seed metadata
│   └── domain/                        ScreenState, Aid, Cursor records
├── src/main/resources/
│   ├── application.yml                port, CORS origins, mode=seed-demo
│   ├── openapi.yml                    copy of contract/openapi.yaml
│   └── seeds/                         <screen>.json files
└── src/test/java/com/example/seed/
    ├── ScreenSeedContractTest.java
    └── TransactionTransitionTest.java
```

Rules:

- Maven build succeeds with no network-dependent plugins beyond central.
- Responses are deterministic for a given seeds directory.
- Tests cover: health, unknown screen 404, valid transaction replay, invalid payload 400/422, transition miss stays on screen.
- The generator may regenerate controllers and domain records; seed JSON files are data owned by the conversion output, regenerated only when the source set changes.

---
