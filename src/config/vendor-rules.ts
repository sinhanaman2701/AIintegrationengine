// ============================================================================
// Integration Engine — Vendor Rules Configuration (POC)
// ============================================================================

import type { VendorEngineRules } from "../integration-engine/types.js";

// Database of rules keyed by vendor ID
const ruleStore: Record<string, VendorEngineRules> = {
    // POC default configuration applied to all vendors
    // 10 calls/10min, 2 retries, 5 failures trips breaker
    default: {
        vendorId: "default",
        rateLimit: {
            maxRequests: 10,
            windowMs: 10 * 60 * 1000, // 10 minutes
        },
        circuitBreaker: {
            failureThreshold: 5,
            cooldownMs: 30 * 1000, // 30 seconds
            initialState: "CLOSED",
        },
        retry: {
            maxRetries: 2, // 3 attempts total
            baseDelayMs: 1000,
            maxDelayMs: 4000,
        },
        timeout: 15000, // 15 seconds Default
    },
};

/**
 * Retrieves the engine rules for a given vendor.
 * Falls back to the default POC rules if no specific rules exist.
 */
export function getVendorRules(vendorId: string): VendorEngineRules {
    return ruleStore[vendorId] ?? ruleStore["default"]!;
}
