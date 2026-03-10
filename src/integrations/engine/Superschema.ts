export interface MeterData {
    meter_id: string;      // The unique identifier for the meter itself (Hardware ID/Serial)
    api_id: string;        // The identifier used to query the API (e.g., CA_ADDRESS, CustomerID)
    vendor_id: string;     // The ID of the vendor (e.g., neptune_ems, e2_meter)
    community_id: string;  // The ID of the community
    unit_id: string;       // The ID of the apartment/flat

    balance: number;                   // Current prepaid balance
    status: 'ONLINE' | 'OFFLINE' | 'ERROR'; // Operational status

    // Readings (using generic terms that apply to water, electricity, DG, etc.)
    current_reading: number;
    previous_reading?: number;
    last_recharge_amount?: number;
    last_recharge_date?: string;
    monthly_consumption?: number;      // Calculated or provided monthly usage

    // Type identifiers for multi-meter setups (e.g. EB vs DG)
    meter_category: 'ELECTRICITY' | 'WATER' | 'GAS' | 'DG';

    last_synced: string; // ISO 8601 Timestamp of last successful fetch

    // Raw vendor response for auditing/debugging
    _raw_vendor_payload?: any;
}

export interface EngineRequest {
    unit_id: string;
    community_id: string;
    vendor_id: string;
    api_parameters: {
        meter_serial?: string;
        customer_id?: string;
        site_code?: string;
        [key: string]: any;
    };
}

export interface VendorCartridge {
    vendor_id: string;
    version: string;

    // Pure function to format the request(s) required by the vendor before firing
    // For E2, it might return TWO requests (CustomerValidation -> MeterReading)
    buildRequests(params: EngineRequest['api_parameters']): {
        url: string;
        method: 'GET' | 'POST';
        headers?: Record<string, string>;
        body?: any;
        sequence: number; // For APIs that require step 1 then step 2
        step_name: string;
    }[];

    // Pure function that maps the raw vendor JSON to our MeterData Superschema
    transform(raw_responses: Record<string, any>, request_context: EngineRequest): MeterData;
}
