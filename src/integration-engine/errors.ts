// ============================================================================
// Integration Engine — Error Types & Classes
// ============================================================================

export enum IntegrationErrorType {
    // ── Vendor Errors (from vendor API) ──
    METER_OFFLINE = "METER_OFFLINE",
    METER_NOT_FOUND = "METER_NOT_FOUND",
    AUTH_FAILED = "AUTH_FAILED",
    VENDOR_RATE_LIMITED = "VENDOR_RATE_LIMITED",
    VENDOR_SERVER_ERROR = "VENDOR_SERVER_ERROR",

    // ── Engine Errors (from our infrastructure) ──
    TIMEOUT = "TIMEOUT",
    CIRCUIT_OPEN = "CIRCUIT_OPEN",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    CARTRIDGE_LOAD_FAILED = "CARTRIDGE_LOAD_FAILED",
    TRANSFORM_FAILED = "TRANSFORM_FAILED",
    SCHEMA_VALIDATION_FAILED = "SCHEMA_VALIDATION_FAILED",

    // ── System Errors ──
    VENDOR_NOT_CONFIGURED = "VENDOR_NOT_CONFIGURED",
    UNKNOWN = "UNKNOWN",
}

export class IntegrationError extends Error {
    public readonly type: IntegrationErrorType;
    public readonly retryable: boolean;
    public readonly vendor?: string;
    public readonly retryAfterMs?: number;

    constructor(
        type: IntegrationErrorType,
        message: string,
        options: {
            retryable?: boolean;
            vendor?: string;
            retryAfterMs?: number;
        } = {}
    ) {
        super(message);
        this.name = "IntegrationError";
        this.type = type;
        this.retryable = options.retryable ?? false;
        this.vendor = options.vendor;
        this.retryAfterMs = options.retryAfterMs;
    }

    /**
     * Formats the error into a standard API response shape.
     */
    toResponse(): IntegrationErrorResponse {
        return {
            success: false,
            error: {
                type: this.type,
                message: this.message,
                vendor: this.vendor,
                retryable: this.retryable,
                retryAfterMs: this.retryAfterMs,
            },
        };
    }
}

export interface IntegrationErrorResponse {
    success: false;
    error: {
        type: IntegrationErrorType;
        message: string;
        vendor?: string;
        retryable: boolean;
        retryAfterMs?: number;
    };
}
