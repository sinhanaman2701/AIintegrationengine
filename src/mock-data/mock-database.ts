// ============================================================================
// Integration Engine — Mock Database
// ============================================================================
// Simulates the ApnaComplex relational database containing the mapping
// between internal entity IDs (like unit_id=123) and external vendor IDs
// (like vendor_meter_id="NP-4421").
// ============================================================================

import type { VendorUnitMapping } from "../integration-engine/types.js";

const mappings: VendorUnitMapping[] = [
    {
        unit_id: 101,
        feature: "electricity",
        vendor_id: "neptune_ems",
        vendor_meter_id: "METER-101-NEPTUNE",
        credentials: { api_key: "test_key_neptune" },
        is_active: true,
    },
    {
        unit_id: 102,
        feature: "electricity",
        vendor_id: "capital_meter",
        vendor_meter_id: "CAP-002",
        credentials: { auth_token: "test_token_capital" },
        is_active: true,
    },
    {
        unit_id: 999,
        feature: "electricity",
        vendor_id: "neptune_ems",
        vendor_meter_id: "INACTIVE-METER",
        credentials: { api_key: "expired" },
        is_active: false,
    },
];

/**
 * Looks up the vendor integration mapping for a given feature and entity.
 */
export function lookupVendor(
    feature: string,
    entityId: number
): VendorUnitMapping | null {
    const mapping = mappings.find(
        (m) => m.feature === feature && m.unit_id === entityId
    );
    return mapping ?? null;
}
