// Deterministic Spring Boot seed-runtime contract artifact generator.
// The generated backend is a demo fixture server (D-11); conversion remains upstream.

import { buildConversionManifest } from './conversionManifest.js';

function json (value) { return JSON.stringify(value, null, 2) + '\n'; }

export function generateSpringBootApp (contract = {}) {
    const screen = contract.displayProfile?.modelKey || 'unknown';
    const bindingMap = Object.fromEntries((contract.mappings ?? []).map(mapping => [
        mapping.sourceIdentity,
        { runtimeBindingKey: mapping.runtimeBindingKey, domId: mapping.domId },
    ]));
    const files = {
        'pom.xml': `<project><modelVersion>4.0.0</modelVersion><groupId>com.example</groupId><artifactId>dspf-runtime</artifactId><version>0.1.0</version><parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.4.0</version></parent><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies><build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build></project>\n`,
        'src/main/resources/application.yml': `dspf:\n  model: ${screen}\nserver:\n  port: 8081\n`,
        'src/main/resources/openapi.yaml': 'openapi: 3.1.0\ninfo:\n  title: DSPF Runtime API\n  version: 2.1.0\npaths:\n  /api/screen:\n    get:\n      responses:\n        "200":\n          description: Screen state\n  /api/transaction:\n    post:\n      responses:\n        "200":\n          description: Transaction result\n',
        'src/main/java/com/example/runtime/RuntimeApplication.java': 'package com.example.runtime;\nimport org.springframework.boot.SpringApplication;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\npublic class RuntimeApplication { public static void main(String[] args) { SpringApplication.run(RuntimeApplication.class, args); } }\n',
        'src/main/java/com/example/runtime/api/ScreenController.java': 'package com.example.runtime.api;\nimport org.springframework.web.bind.annotation.GetMapping;\nimport org.springframework.web.bind.annotation.RestController;\n@RestController\npublic class ScreenController { @GetMapping("/api/screen") public String screen() { return "{\\"status\\":\\"contract-only\\"}"; } }\n',
        'src/main/java/com/example/runtime/api/TransactionController.java': 'package com.example.runtime.api;\nimport org.springframework.web.bind.annotation.PostMapping;\nimport org.springframework.web.bind.annotation.RestController;\n@RestController\npublic class TransactionController { @PostMapping("/api/transaction") public String transaction() { return "{\\"status\\":\\"contract-only\\"}"; } }\n',
        'src/main/java/com/example/runtime/domain/ScreenState.java': 'package com.example.runtime.domain;\npublic record ScreenState(String status) {}\n',
        'src/main/java/com/example/runtime/domain/TransactionCommand.java': 'package com.example.runtime.domain;\npublic record TransactionCommand(String screen, String aid) {}\n',
        'src/main/java/com/example/runtime/application/IdempotencyService.java': 'package com.example.runtime.application;\npublic class IdempotencyService {}\n',
        'src/main/java/com/example/runtime/security/SecurityConfig.java': 'package com.example.runtime.security;\npublic class SecurityConfig {}\n',
        'src/main/java/com/example/runtime/audit/AuditEventService.java': 'package com.example.runtime.audit;\npublic class AuditEventService {}\n',
        'src/test/java/com/example/runtime/ScreenControllerContractTest.java': 'package com.example.runtime;\nclass ScreenControllerContractTest {}\n',
        'README.generated.txt': 'Generated seed runtime contract. This is a demo fixture server (mode: seed-demo); implement real authority before any production use.\n',
    };
    files['binding-map.json'] = json(bindingMap);
    files['traceability.json'] = json((contract.mappings ?? []).map(mapping => mapping.traceability));
    files['conversion-report.json'] = json({
        version: contract.version || '2.1.0',
        displayProfile: contract.displayProfile || null,
        mappingCount: (contract.mappings ?? []).length,
        diagnostics: contract.diagnostics ?? [],
        status: (contract.diagnostics ?? []).length ? 'manual-review' : 'generated',
        mode: 'seed-demo',
    });
    const overrideEvidence = contract.overridesHash
        ? { overridesHash: contract.overridesHash, overridesApplied: contract.overridesApplied ?? 0 }
        : {};
    files['conversion-manifest.json'] = json(buildConversionManifest({
        generator: 'generateSpringBootApp',
        contractVersion: contract.version || '2.1.0',
        files,
        extra: {
            mappingCount: (contract.mappings ?? []).length,
            diagnosticCount: (contract.diagnostics ?? []).length,
            mode: 'seed-demo',
            ...overrideEvidence,
        },
    }));
    return files;
}
