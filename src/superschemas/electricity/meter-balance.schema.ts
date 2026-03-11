// ============================================================================
// Superschema — Electricity Meter Balance (POC)
// ============================================================================
// The canonical output format for meter balance data.
// All vendor cartridges must transform their responses into this shape.
//
// POC fields:
//   - meter_id:      string  (linked to user/unit)
//   - meter_balance:  number  (current meter balance)
// ============================================================================

import type { ElectricityMeterBalance } from "../../integration-engine/types.js";

/**
 * Schema definition for the Electricity Meter Balance superschema.
 * Defines required fields and their expected types.
 */
export const meterBalanceSchema = {
    name: "electricity.meterBalance",
    fields: {
        meter_id: { type: "string" as const, required: true },
        meter_balance: { type: "number" as const, required: true },
    },
};

/**
 * Validates that the given data conforms to the ElectricityMeterBalance superschema.
 *
 * @param data - The transformed data to validate
 * @returns The validated data cast to ElectricityMeterBalance
 * @throws Error with details if validation fails
 */
export function validateMeterBalance(data: unknown): ElectricityMeterBalance {
    if (!data || typeof data !== "object") {
        throw new Error(
            `Schema validation failed for ${meterBalanceSchema.name}: data must be a non-null object`
        );
    }

    const record = data as Record<string, unknown>;
    const errors: string[] = [];

    // Check meter_id
    if (!("meter_id" in record)) {
        errors.push("missing required field: meter_id");
    } else if (typeof record.meter_id !== "string") {
        errors.push(
            `meter_id must be a string, got ${typeof record.meter_id}`
        );
    } else if (record.meter_id.length === 0) {
        errors.push("meter_id must not be empty");
    }

    // Check meter_balance
    if (!("meter_balance" in record)) {
        errors.push("missing required field: meter_balance");
    } else if (typeof record.meter_balance !== "number") {
        errors.push(
            `meter_balance must be a number, got ${typeof record.meter_balance}`
        );
    } else if (isNaN(record.meter_balance)) {
        errors.push("meter_balance must not be NaN");
    }

    if (errors.length > 0) {
        throw new Error(
            `Schema validation failed for ${meterBalanceSchema.name}: ${errors.join("; ")}`
        );
    }

    return {
        meter_id: record.meter_id as string,
        meter_balance: record.meter_balance as number,
    };
}
