# 02 Backend File Template

## 1. Generated backend contract package



```text
backend-contract/
├── openapi.yaml
├── schemas/
│   ├── conversion.yaml
│   ├── screen.yaml
│   ├── transaction.yaml
│   ├── error.yaml
│   └── approval.yaml
├── examples/
│   ├── signon-screen.json
│   └── enter-transaction.json
└── README.md
```

## 2. Optional Node conversion service



```text
conversion-service/
├── package.json
├── src/
│   ├── server.js
│   ├── routes/
│   │   ├── conversions.js
│   │   └── health.js
│   ├── application/
│   │   ├── createConversion.js
│   │   ├── readConversion.js
│   │   ├── readReport.js
│   │   └── readRuntimeBinding.js
│   ├── adapters/
│   │   ├── sharedCoreAdapter.js
│   │   ├── artifactStore.js
│   │   └── externalRuntimeBindingAdapter.js
│   └── errors.js
├── test/
│   ├── contract.test.js
│   └── revision-isolation.test.js
└── README.md
```

## 3. Spring Boot runtime template



```text
spring-runtime/
├── pom.xml
├── src/main/java/com/example/runtime/
│   ├── RuntimeApplication.java
│   ├── api/
│   │   ├── ScreenController.java
│   │   ├── TransactionController.java
│   │   └── ErrorResponse.java
│   ├── application/
│   │   ├── ScreenSessionService.java
│   │   ├── TransactionService.java
│   │   └── IdempotencyService.java
│   ├── domain/
│   │   ├── ScreenState.java
│   │   ├── TransactionCommand.java
│   │   ├── Aid.java
│   │   ├── CursorState.java
│   │   └── SubfileState.java
│   ├── security/
│   │   ├── AuthorizationService.java
│   │   └── SecurityConfig.java
│   ├── audit/
│   │   └── AuditEventService.java
│   └── infrastructure/
│       ├── ScreenRepository.java
│       └── TransactionRepository.java
├── src/main/resources/
│   ├── application.yml
│   └── openapi.yaml
└── src/test/java/com/example/runtime/
    ├── ScreenControllerContractTest.java
    ├── TransactionIdempotencyTest.java
    └── AuthorizationTest.java
```

## 4. Optional SQLite metadata template



```text
conversion-metadata/
├── migrations/
│   ├── V001__conversion_job.sql
│   ├── V002__conversion_revision.sql
│   ├── V003__conversion_review.sql
│   └── V004__audit_event.sql
├── repository/
│   └── metadataRepository.js
└── README.md
```

SQLite stores conversion metadata only. It does not store the authoritative business transaction state.
