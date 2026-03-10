import type { VendorCartridge, EngineRequest, MeterData } from '../engine/Superschema';

export const CapitalMeterCartridge: VendorCartridge = {
    vendor_id: 'capital_meter',
    version: '1.0.0',

    /**
     * Builds the HTTP request for Capital Meter's Consumer Meter endpoint.
     * Capital uses a simple GET with query params and an apikey header.
     */
    buildRequests(params: EngineRequest['api_parameters']) {

        const consumerId = params.customer_id || '';
        const siteId = params.site_code || 'SpectrumMall002';

        const requests = [];

        // STEP 1: Fetch full meter details (Grid server)
        requests.push({
            url: `https://smartprepaidmeters.com/integration_api/v1/consumer/meter?site_id=${siteId}&consumer_id=${consumerId}`,
            method: 'GET' as const,
            headers: {
                'apikey': '<INJECT_API_KEY>' // Engine will replace
            },
            body: undefined,
            sequence: 1,
            step_name: 'ConsumerMeter'
        });

        return requests;
    },

    /**
     * Pure transformation: Capital Meter /consumer/meter → MeterData Superschema.
     * NO network logic. NO state. Just data mapping.
     *
     * CRITICAL: All numeric fields from Capital come as STRINGS.
     * Every value must be parseFloat()'d.
     */
    transform(raw_responses: Record<string, any>, request_ctx: EngineRequest): MeterData {

        const raw = raw_responses['ConsumerMeter'];

        if (!raw || raw.status !== 'T') {
            throw new Error(`Capital Meter API Error: ${raw?.message || 'No response received'}`);
        }

        const d = raw.data;

        if (!d) {
            throw new Error('Capital Meter API returned null data.');
        }

        // --- STATUS CONVERSION ---
        // Capital: "UP" / "DOWN"
        // Superschema: "ONLINE" / "OFFLINE" / "ERROR"
        let status: 'ONLINE' | 'OFFLINE' | 'ERROR' = 'OFFLINE';
        if (d.status === 'UP') {
            status = 'ONLINE';
        }

        // --- BALANCE (String → Number) ---
        const balance = parseFloat(d.balance) || 0;

        // --- READINGS (All Strings → Numbers) ---
        const gridReadingKwh = parseFloat(d.grid_reading_kwh) || 0;

        // --- LAST RECHARGE ---
        const lastRechargeAmount = parseFloat(d.last_recharge_amount) || 0;

        // --- TIMESTAMP (Epoch ms string → ISO 8601) ---
        let lastRechargeDate: string | undefined;
        if (d.last_recharge_timestamp) {
            const epochMs = parseInt(d.last_recharge_timestamp, 10);
            if (!isNaN(epochMs)) {
                lastRechargeDate = new Date(epochMs).toISOString();
            }
        }

        return {
            meter_id: d.meter_no || 'Unknown',
            api_id: d.consumer_id || request_ctx.api_parameters.customer_id || '',
            vendor_id: this.vendor_id,
            community_id: request_ctx.community_id,
            unit_id: d.unit_no || request_ctx.unit_id,

            balance,
            status,

            current_reading: gridReadingKwh,
            previous_reading: undefined, // Not provided by this endpoint
            last_recharge_amount: lastRechargeAmount,
            last_recharge_date: lastRechargeDate,

            meter_category: 'ELECTRICITY',
            last_synced: new Date().toISOString(),

            _raw_vendor_payload: d
        };
    }
};
