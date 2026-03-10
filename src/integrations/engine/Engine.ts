import type { VendorCartridge, EngineRequest, MeterData } from './Superschema';

// Simulated DB / Config storage
const VENDOR_CREDENTIALS: Record<string, Record<string, string>> = {
    'e2_meter': {
        'API_KEY': 'simulated_secret_key_123',
    }
};

// Simulated Redis Rate Limiter State
const RATE_LIMIT_BUCKETS: Record<string, number> = {
    'e2_meter': 100 // 100 requests remaining
};

// Simulated Circuit Breaker State
const CIRCUIT_BREAKER: Record<string, { failures: number, tripped_until: number | null }> = {
    'e2_meter': { failures: 0, tripped_until: null }
};


export class IntegrationEngine {

    // Custom Error Types
    static VENDOR_TIMEOUT = 'VENDOR_TIMEOUT';
    static CARTRIDGE_ERROR = 'CARTRIDGE_MAPPING_ERROR';
    static CIRCUIT_OPEN = 'VENDOR_CIRCUIT_OPEN';
    static RATE_LIMIT = 'VENDOR_RATE_LIMIT_EXCEEDED';

    /**
     * Safe execution wrapper for HTTP calls with hard timeouts
     */
    private static async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000): Promise<Response> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error: any) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error(this.VENDOR_TIMEOUT);
            }
            throw error;
        }
    }

    /**
     * Central execution method taking a platform request and a stateless cartridge
     */
    static async execute(request: EngineRequest, cartridge: VendorCartridge): Promise<MeterData | { error: string, message: string }> {

        const vendorId = cartridge.vendor_id;

        console.log(`[ENGINE] Starting execution for Vendor: ${vendorId}, Unit: ${request.unit_id}`);

        // RULE 2.2: Circuit Breaker Check
        const cb = CIRCUIT_BREAKER[vendorId];
        if (cb && cb.tripped_until && Date.now() < cb.tripped_until) {
            console.warn(`[ENGINE ERROR] Circuit Breaker OPEN for ${vendorId}`);
            return { error: this.CIRCUIT_OPEN, message: `Too many failures. Vendor quarantined.` };
        }

        // RULE 3.1: Rate Limiter Check
        if (RATE_LIMIT_BUCKETS[vendorId] !== undefined) {
            if (RATE_LIMIT_BUCKETS[vendorId] <= 0) {
                console.warn(`[ENGINE ERROR] Rate Limit EXCEEDED for ${vendorId}`);
                return { error: this.RATE_LIMIT, message: `Vendor rate limit reached. Try again later.` };
            }
            RATE_LIMIT_BUCKETS[vendorId]--; // Consume a token
        }

        // Build the deterministic network requests using the Cartridge
        let requestsToFire;
        try {
            requestsToFire = cartridge.buildRequests(request.api_parameters);
            // Sort to ensure sequential execution if Vendor requires Step 1 -> Step 2
            requestsToFire.sort((a, b) => a.sequence - b.sequence);
        } catch (e: any) {
            console.error(`[ENGINE CRITICAL] Cartridge ${vendorId} threw error building requests.`, e);
            return { error: this.CARTRIDGE_ERROR, message: 'Invalid cartridge Request design.' };
        }

        const rawVendorResponses: Record<string, any> = {};

        // RULE 4.2 & 1.1: Aggregation and Timeout Execution
        for (const reqConfig of requestsToFire) {
            let retryCount = 0;
            let success = false;
            const MAX_RETRIES = 2; // RULE 2.1 Exponential Backoff

            while (retryCount <= MAX_RETRIES && !success) {
                try {
                    // RULE 5.1: Secret Injection (Cartridge only provided placeholder header)
                    const finalHeaders = { ...reqConfig.headers }; // clone
                    if (finalHeaders['Authorization'] === '<INJECT_TOKEN>') {
                        finalHeaders['Authorization'] = `Bearer ${VENDOR_CREDENTIALS[vendorId]?.['API_KEY']}`;
                    }

                    console.log(`[ENGINE NETWORK] -> Firing ${reqConfig.method} ${reqConfig.url} (Step: ${reqConfig.step_name})`);

                    // Execute with 5-second hard timeout
                    const response = await this.fetchWithTimeout(reqConfig.url, {
                        method: reqConfig.method,
                        headers: finalHeaders,
                        body: reqConfig.body ? JSON.stringify(reqConfig.body) : undefined
                    });

                    // RULE 2.1: Catch 5xx for retries, 4xx for immediate failure
                    if (!response.ok) {
                        if (response.status >= 500) {
                            throw new Error(`Server Error: ${response.status}`);
                        } else {
                            // 400s don't get retried
                            throw new Error(`Client Error: ${response.status}`);
                        }
                    }

                    const data = await response.json();
                    rawVendorResponses[reqConfig.step_name] = data;

                    // Reset circuit breaker on success
                    if (cb) cb.failures = 0;
                    success = true;

                } catch (error: any) {

                    if (error.message === this.VENDOR_TIMEOUT || error.message.includes('Server Error')) {
                        retryCount++;
                        if (retryCount <= MAX_RETRIES) {
                            const delay = Math.pow(2, retryCount) * 500; // Exponential: 1s, 2s
                            console.warn(`[ENGINE RETRY] ${reqConfig.step_name} failed. Retrying in ${delay}ms...`);
                            await new Promise(res => setTimeout(res, delay));
                        } else {
                            // Out of retries, trip circuit breaker logic
                            if (cb) {
                                cb.failures++;
                                if (cb.failures >= 5) {
                                    cb.tripped_until = Date.now() + (5 * 60 * 1000); // Trip for 5 mins
                                    console.error(`[ENGINE CRITICAL] ${vendorId} Circuit Tripped!`);
                                }
                            }
                            return { error: 'VENDOR_COMMUNICATION_FAILED', message: `Final failure after retries: ${error.message}` };
                        }
                    } else {
                        // 400 error, fail immediately
                        return { error: 'VENDOR_REQUEST_INVALID', message: error.message };
                    }
                }
            }
        }

        // RULE 1.2: Cartridge Sandboxing (Transformation execution)
        try {
            console.log(`[ENGINE] Handing raw responses to Cartridge for Transformation...`);
            const mappedData = cartridge.transform(rawVendorResponses, request);

            // Inject raw payload for audit trails
            mappedData._raw_vendor_payload = rawVendorResponses;

            return mappedData;

        } catch (e: any) {
            console.error(`[ENGINE CRITICAL] Cartridge Mapping Error for ${vendorId}:`, e);
            return { error: this.CARTRIDGE_ERROR, message: `Transformation failed: ${e.message}` };
        }
    }
}
