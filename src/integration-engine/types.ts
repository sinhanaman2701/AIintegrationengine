// ============================================================================
// Integration Engine — Type Definitions
// ============================================================================

// ── Integration Request/Response ──

export interface IntegrationRequest {
    feature: string;          // e.g., "electricity"
    entityId: number;         // e.g., unit_id = 123
    operation: string;        // e.g., "getMeterBalance"
    params: Record<string, unknown>;  // Additional params from the caller
}

export interface IntegrationResponse {
    success: true;
    data: Record<string, unknown>;
}

// ── Routing ──

export interface RoutingResult {
    vendorId: string;         // e.g., "neptune_ems"
    cartridgeId: string;      // e.g., "neptune_ems" (usually same as vendorId)
    vendorEntityId: string;   // e.g., "NP-4421" (vendor's own identifier)
    credentials: VendorCredentials;
}

export interface VendorCredentials {
    api_key?: string;
    auth_token?: string;
}

// ── Vendor Cartridge Interface ──
// This is the contract that every cartridge must implement.

export interface VendorCartridge {
    id: string;               // e.g., "neptune_ems"
    vendor: string;           // e.g., "Neptune"
    feature: string;          // e.g., "electricity"
    version: string;          // e.g., "1.0.0"
    operations: Record<string, CartridgeOperation>;
}

export interface CartridgeOperation {
    request: CartridgeRequestDefinition;
    buildRequest: (params: BuildRequestParams) => VendorRequestOutput;
    transformResponse: (vendorResponse: unknown) => Record<string, unknown>;
    errorMap: Record<string, string>;
}

export interface CartridgeRequestDefinition {
    method: "GET" | "POST";
    baseUrl: string;
    path: string;             // Can contain {placeholders}
    headers: Record<string, string>;
    queryParams?: Record<string, string>;
    authType: "api_key" | "bearer" | "basic" | "none";
}

export interface BuildRequestParams {
    entityId: number;
    vendorEntityId: string;
    credentials: VendorCredentials;
    params: Record<string, unknown>;
}

export interface VendorRequestOutput {
    url: string;              // Fully resolved URL
    headers: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: string;
}

// ── Engine Rules Configuration ──

export interface VendorEngineRules {
    vendorId: string;
    rateLimit: {
        maxRequests: number;    // 10 for POC
        windowMs: number;       // 600000 (10 min) for POC
    };
    circuitBreaker: {
        failureThreshold: number;   // 5 consecutive failures to trip
        cooldownMs: number;         // 30000 (30s) cooldown
        initialState: "CLOSED";
    };
    retry: {
        maxRetries: number;     // 2 retries (3 total attempts)
        baseDelayMs: number;    // 1000ms base delay
        maxDelayMs: number;     // 4000ms max delay
    };
    timeout: number;          // 5000ms HTTP request timeout
}

// ── Vendor-to-Unit Mapping (Database) ──

export interface VendorUnitMapping {
    unit_id: number;
    feature: string;          // "electricity" | "parking" | etc.
    vendor_id: string;        // "neptune_ems" | "capital_meter"
    vendor_meter_id: string;  // Vendor's own identifier for this unit
    credentials: VendorCredentials;
    is_active: boolean;
}

// ── Superschema: Electricity Meter Balance (POC) ──

export interface ElectricityMeterBalance {
    meter_id: string;         // Meter identifier (linked to user/unit)
    meter_balance: number;    // Current meter balance
}

// ── HTTP Executor Types ──

export interface HttpRequest {
    url: string;
    method: "GET" | "POST";
    headers: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: string;
    timeout: number;
}

export interface HttpResponse {
    status: number;
    data: unknown;
    headers: Record<string, string>;
}

// ── Sandbox Options ──

export interface SandboxOptions {
    timeout: number;          // Max execution time in ms
}
