// Contract test for generated Spring Boot artifact completeness.

import { describe, expect, it } from 'vitest';
import { generateSpringBootApp } from './springBoot.js';

describe('Spring Boot generator', () => {
    it('generates the runtime contract file set', () => {
        const files = generateSpringBootApp({ version: '2.1.0', displayProfile: { modelKey: '24x80' }, mappings: [] });
        expect(Object.keys(files)).toEqual(expect.arrayContaining([
            'pom.xml', 'src/main/resources/application.yml', 'src/main/resources/openapi.yaml',
            'src/main/java/com/example/runtime/RuntimeApplication.java',
            'src/main/java/com/example/runtime/api/ScreenController.java',
            'src/main/java/com/example/runtime/api/TransactionController.java',
        ]));
        expect(files['src/main/resources/openapi.yaml']).toContain('/api/screen');
        expect(files['src/main/java/com/example/runtime/RuntimeApplication.java']).toContain('@SpringBootApplication');
    });
});

    it('generates the complete Spring runtime project boundary', () => {
        const files = generateSpringBootApp({ version: '3.5', displayProfile: { modelKey: '24x80' }, mappings: [] });
        expect(Object.keys(files)).toEqual(expect.arrayContaining([
            'src/main/java/com/example/runtime/domain/ScreenState.java',
            'src/main/java/com/example/runtime/domain/TransactionCommand.java',
            'src/main/java/com/example/runtime/application/IdempotencyService.java',
            'src/main/java/com/example/runtime/security/SecurityConfig.java',
            'src/main/java/com/example/runtime/audit/AuditEventService.java',
            'src/test/java/com/example/runtime/ScreenControllerContractTest.java',
        ]));
    });
