import type { VendorCartridge, EngineRequest, MeterData } from '../engine/Superschema';

export const NeptuneEmsCartridge: VendorCartridge = {
    vendor_id: 'neptune_ems',
    version: '1.0.0',

    /**
     * Builds the HTTP request(s) for Neptune EMS.
     * Neptune uses a single monolith endpoint with form-encoded body
     * and routes via TXN_NAME.
     */
    buildRequests(params: EngineRequest['api_parameters']) {

        const referenceNo = params.customer_id || '';
        const siteCode = params.site_code || '114';

        const requests = [];

        // STEP 1: Fetch live data for a single meter
        const formBody = new URLSearchParams();
        formBody.append('TXN_NAME', 'LIVEDATAFORSINGLE');
        formBody.append('DATA', `{Reference_No:"${referenceNo}"}`);
        formBody.append('SITECODE', siteCode);
        formBody.append('username', '<INJECT_USERNAME>');  // Engine will replace
        formBody.append('password', '<INJECT_PASSWORD>');  // Engine will replace

        requests.push({
            url: 'https://emsprepaidapi.neptuneenergia.com/service.asmx/liveEmsTransaction',
            method: 'POST' as const,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formBody.toString(),
            sequence: 1,
            step_name: 'LiveDataForSingle'
        });

        return requests;
    },

    /**
     * Pure transformation: Neptune LIVEDATAFORSINGLE → MeterData Superschema.
     * NO network logic. NO state. Just data mapping.
     */
    transform(raw_responses: Record<string, any>, request_ctx: EngineRequest): MeterData {

        const raw = raw_responses['LiveDataForSingle'];

        if (!raw || raw.Status !== 'Success') {
            throw new Error(`Neptune API Error: ${raw?.Msg || 'No response received'}`);
        }

        const d = Array.isArray(raw.data) ? raw.data[0] : raw.data;

        if (!d) {
            throw new Error('Neptune API returned empty data array.');
        }

        // --- STATUS CONVERSION ---
        // Neptune: "Active" | anything else
        // Superschema: "ONLINE" | "OFFLINE" | "ERROR"
        let status: 'ONLINE' | 'OFFLINE' | 'ERROR' = 'OFFLINE';
        if (d.STATUS === 'Active') {
            status = 'ONLINE';
        }

        // --- BALANCE ---
        // Neptune: PV_BAL is a raw number (can be negative)
        const balance = typeof d.PV_BAL === 'number'
            ? d.PV_BAL
            : parseFloat(d.PV_BAL) || 0;

        // --- READINGS ---
        const currentReading = typeof d.EB_PV_READING === 'number'
            ? d.EB_PV_READING
            : parseFloat(d.EB_PV_READING) || 0;

        const previousReading = typeof d.EB_OPENING_READING === 'number'
            ? d.EB_OPENING_READING
            : parseFloat(d.EB_OPENING_READING) || 0;

        // --- LAST RECHARGE ---
        const lastRechargeAmount = typeof d.last_recharge === 'number'
            ? d.last_recharge
            : parseFloat(d.last_recharge) || 0;

        return {
            meter_id: d.DEVICE_SLNO?.toString() || 'Unknown',
            api_id: d.CA_ADDRESS || request_ctx.api_parameters.customer_id || '',
            vendor_id: this.vendor_id,
            community_id: request_ctx.community_id,
            unit_id: request_ctx.unit_id,

            balance,
            status,

            current_reading: currentReading,
            previous_reading: previousReading,
            last_recharge_amount: lastRechargeAmount,
            last_recharge_date: undefined, // Not provided by LIVEDATAFORSINGLE

            monthly_consumption: currentReading - previousReading,

            meter_category: 'ELECTRICITY',
            last_synced: new Date().toISOString(),

            _raw_vendor_payload: d  // Preserve raw payload for auditing
        };
    }
};
