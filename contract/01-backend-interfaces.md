# 01 Backend Interfaces

The normative endpoint and schema contract is `contract/openapi.yaml`. This document explains ownership and implementation boundaries.

## 1. Interface layers



Keep the conversion API and generated runtime API separate.

```text
/api/conversions/*     conversion-time API
/api/screens/*         runtime screen API
/api/transaction       runtime transaction API
/api/health            service health
```

Generated React clients must consume the OpenAPI contract. Spring Boot controllers must implement the same contract because client and server must not invent different request shapes.

## 2. Conversion API



### Create conversion

```http
POST /api/conversions
Content-Type: application/json
```

```json
{
  "projectId": "dspf-rad",
  "sourceName": "SIGNON.DSPF",
  "sourceRevision": "R1",
  "sourceText": "...",
  "conversionProfile": "modern-react-v1"
}
```

Response:

```json
{
  "conversionId": "cv_123",
  "sourceRevision": "R1",
  "converterVersion": "1.0.0",
  "status": "draft"
}
```

### Read conversion status

```http
GET /api/conversions/{conversionId}
```

```json
{
  "conversionId": "cv_123",
  "status": "manual-review",
  "sourceRevision": "R1",
  "counts": {
    "converted": 18,
    "warning": 2,
    "manualReview": 3,
    "unsupported": 1,
    "error": 0
  }
}
```

### Read generated code

```http
GET /api/conversions/{conversionId}/code
```

Return a file manifest or an archive reference. Do not return an unbounded source response without size limits.

### Read conversion report

```http
GET /api/conversions/{conversionId}/report
```

Return the report, manifest hash, source hash, converter version, warnings, errors, and review items.

## 3. Runtime screen API



### Read screen

```http
GET /api/screens/{screenName}?revision=R1
```

```json
{
  "screen": "SIGNON",
  "revision": "R1",
  "modelKey": "24x80",
  "record": "SIGNON",
  "fields": [],
  "messages": [],
  "actions": [],
  "subfiles": [],
  "cursor": {}
}
```

### Submit screen transaction

```http
POST /api/transaction
Content-Type: application/json
Idempotency-Key: request-123
X-Correlation-Id: trace-123
```

```json
{
  "sessionId": "session-123",
  "screen": "SIGNON",
  "screenRevision": "R1",
  "aid": {
    "kind": "ENTER",
    "number": null
  },
  "fields": {
    "SIGNON.USER": "demo"
  },
  "cursor": {
    "field": "SIGNON.USER",
    "row": 2,
    "col": 3
  },
  "subfiles": {}
}
```

Response:

```json
{
  "screen": "MENU",
  "screenRevision": "R1",
  "messages": [],
  "fieldValues": {},
  "indicators": {},
  "cursor": {},
  "subfiles": {},
  "nextActions": [],
  "correlationId": "trace-123"
}
```

## 4. Error contract



| Status | Meaning |
|---|---|
| 400 | Invalid request shape |
| 401 | Session or authentication is missing |
| 403 | The actor has no permission |
| 404 | Screen or conversion does not exist |
| 409 | Revision or concurrency conflict |
| 422 | Business or field validation error |
| 429 | Rate or duplicate request limit |
| 440 | Session expired |
| 500 | Unexpected server error |

Every error response includes:

```json
{
  "code": "SCREEN_REVISION_CONFLICT",
  "message": "The requested screen revision is not current.",
  "correlationId": "trace-123",
  "details": []
}
```

## 5. Backend interface classes



### Spring Boot conversion classes

```text
ConversionController
ConversionService
ConversionJobRepository
ConversionArtifactRepository
ConversionReportService
ConversionApprovalService
ConversionAuthorizationService
```

### Spring Boot runtime classes

```text
ScreenController
TransactionController
ScreenSessionService
TransactionService
FieldValidationService
AuthorizationService
IdempotencyService
AuditEventService
CorrelationIdFilter
GlobalExceptionHandler
```

### Node wrapper classes

```text
ConversionHttpServer
ConversionRequestHandler
SharedConversionCoreAdapter
ArtifactStore
RevisionStore
```

The Node wrapper must call the same shared conversion core as the browser and CLI. The Node wrapper must not contain a second layout or binding implementation.

## 6. Runtime security rules



- Keep authentication and authorization in Spring Boot.
- Keep idempotency enforcement in Spring Boot.
- Do not use local mode to bypass production authentication.
- Do not place secrets or sensitive field values in DOM ids.
- Do not write sensitive field values to conversion logs.
- Record correlation IDs in server logs and audit events.

---
