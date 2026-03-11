// ============================================================================
// Integration Engine — Schema Validator
// ============================================================================
// Validates Cartridge output against the appropriate Superschema.
// Ensures all vendor data transformations produce the correct shape.
// ============================================================================

import { IntegrationError, IntegrationErrorType } from "./errors.js";
import { validateMeterBalance } from "../superschemas/electricity/meter-balance.schema.js";

// Registry of schema validators by feature + operation
type ValidatorFn = (data: unknown) => Record<string, unknown>;

const schemaRegistry: Map<string, ValidatorFn> = new Map([
    ["electricity:getMeterBalance", validateMeterBalance as ValidatorFn],
]);

export class SchemaValidator {
    /**
     * Validates transformed data against the correct superschema.
     *
     * @param feature   - Feature domain (e.g., "electricity")
     * @param operation - Operation name (e.g., "getMeterBalance")
     * @param data      - The transformed data to validate
     * @returns The validated data
     * @throws IntegrationError if validation fails or no schema found
     */
    validate(
        feature: string,
        operation: string,
        data: unknown
    ): Record<string, unknown> {
        const key = `${feature}:${operation}`;
        const validator = schemaRegistry.get(key);

        if (!validator) {
            throw new IntegrationError(
                IntegrationErrorType.SCHEMA_VALIDATION_FAILED,
                `No schema registered for "${key}". Available schemas: [${Array.from(schemaRegistry.keys()).join(", ")}]`,
                { retryable: false }
            );
        }

        try {
            return validator(data);
        } catch (error) {
            throw new IntegrationError(
                IntegrationErrorType.SCHEMA_VALIDATION_FAILED,
                error instanceof Error ? error.message : String(error),
                { retryable: false }
            );
        }
    }

    /**
     * Registers a custom schema validator. Used for testing or future feature domains.
     */
    static registerSchema(
        feature: string,
        operation: string,
        validator: ValidatorFn
    ): void {
        schemaRegistry.set(`${feature}:${operation}`, validator);
    }
}
