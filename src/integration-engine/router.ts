// ============================================================================
// Integration Engine — Router
// ============================================================================
// Determines which cartridge to load for a given request.
// Queries the mock database to find vendor assignment for the given entity.
// ============================================================================

import type { RoutingResult } from "./types.js";
import { IntegrationError, IntegrationErrorType } from "./errors.js";
import { lookupVendor } from "../mock-data/mock-database.js";

export class Router {
    /**
     * Resolves the vendor and cartridge for a given feature + entity.
     *
     * @param feature  - The feature domain (e.g., "electricity")
     * @param entityId - The entity identifier (e.g., unit_id = 123)
     * @returns RoutingResult with vendor/cartridge info and credentials
     * @throws IntegrationError if no vendor is configured for this entity
     */
    async resolve(feature: string, entityId: number): Promise<RoutingResult> {
        const mapping = lookupVendor(feature, entityId);

        if (!mapping) {
            throw new IntegrationError(
                IntegrationErrorType.VENDOR_NOT_CONFIGURED,
                `No vendor configured for feature="${feature}", entityId=${entityId}`,
                { retryable: false }
            );
        }

        if (!mapping.is_active) {
            throw new IntegrationError(
                IntegrationErrorType.VENDOR_NOT_CONFIGURED,
                `Vendor "${mapping.vendor_id}" is inactive for entityId=${entityId}`,
                { retryable: false }
            );
        }

        return {
            vendorId: mapping.vendor_id,
            cartridgeId: mapping.vendor_id, // Cartridge ID matches vendor ID
            vendorEntityId: mapping.vendor_meter_id,
            credentials: mapping.credentials,
        };
    }
}
