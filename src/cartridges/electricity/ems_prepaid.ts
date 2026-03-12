// ============================================================================
// Cartridge: EMS Prepaid (Neptune Energia)
// ============================================================================
// Feature:   electricity
// Operation: getMeterBalance
//
// API:  POST https://emsprepaidapi.neptuneenergia.com/service.asmx/liveEmsTransaction
// Auth: Form body credentials (SITECODE, username, password)
// TXN:  LIVEDATAFORSINGLE — returns balance for a single unit by ca_address
//
// Mapping (verified against PM's Postman response 2026-03-12):
//   meter_id      ← CA_ADDRESS   (the unit's flat/address identifier)
//   meter_balance ← PV_BAL       (current prepaid balance as a number)
// ============================================================================

import type { VendorCartridge, BuildRequestParams, VendorRequestOutput } from "../../integration-engine/types.js";

const BASE_URL = "https://emsprepaidapi.neptuneenergia.com/service.asmx/liveEmsTransaction";

// Credentials are injected by the Engine at runtime via the database mapping.
// The cartridge uses placeholder strings — the Engine replaces them before execution.
const SITECODE = "114";
const USERNAME = "Admin";
const PASSWORD = "EMS@123DEMO";

const emsPrepaidCartridge: VendorCartridge = {
    id: "ems_prepaid",
    vendor: "Neptune Energia (EMS Prepaid)",
    feature: "electricity",
    version: "1.0.0",

    operations: {
        getMeterBalance: {
            request: {
                method: "POST",
                baseUrl: BASE_URL,
                path: "",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                authType: "none", // Auth passed in form body
            },

            // buildRequest: constructs the POST body for LIVEDATAFORSINGLE.
            // vendorEntityId = the unit's ca_address (e.g. "T1-101")
            // Ground truth: PM's verified Postman collection (2026-03-12)
            buildRequest: (params: BuildRequestParams): VendorRequestOutput => {
                const caAddress = params.vendorEntityId;

                const bodyParams = new URLSearchParams({
                    TXN_NAME: "LIVEDATAFORSINGLE",
                    // NOTE: The API uses a non-standard object notation with unquoted keys.
                    // Verified via curl: {Reference_No:"DEMO-1"} works; JSON.stringify does not.
                    DATA: `{Reference_No:"${caAddress}"}`,
                    SITECODE: SITECODE,
                    username: USERNAME,
                    password: PASSWORD,
                });

                return {
                    url: BASE_URL,
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: bodyParams.toString(),
                };
            },

            // transformResponse: maps vendor JSON → Superschema.
            // Ground truth: PM's verified Postman response (2026-03-12):
            // { "Status":"Success", "Msg":"Transaction Found", "data":[{
            //   "CA_ADDRESS":"DEMO-1", "PV_BAL":7703.00000, ... }] }
            //
            // NOTE: The EMS Prepaid API (hosted on Microsoft-IIS) does NOT return a
            // Content-Type: application/json header. The HttpExecutor therefore
            // parses the response as text. We handle both string and object here.
            transformResponse: (vendorResponse: unknown): Record<string, unknown> => {
                // Parse string response if returned as text (IIS quirk)
                const parsed =
                    typeof vendorResponse === "string"
                        ? (JSON.parse(vendorResponse) as unknown)
                        : vendorResponse;

                const raw = parsed as {
                    Status: string;
                    Msg: string;
                    data: Array<{
                        CA_ADDRESS: string;
                        PV_BAL: number;
                    }> | null;
                };

                // Check vendor-level failure
                if (raw.Status !== "Success" || !raw.data || raw.data.length === 0) {
                    throw new Error(`EMS Prepaid API error: ${raw.Msg}`);
                }

                const record = raw.data[0];

                return {
                    meter_id: record.CA_ADDRESS,
                    meter_balance: Number(record.PV_BAL),
                };
            },

            errorMap: {
                "Transaction Not Found": "METER_NOT_FOUND",
                "Invalid Credentials": "AUTH_FAILED",
                "Failed": "VENDOR_SERVER_ERROR",
            },
        },
    },
};

export default emsPrepaidCartridge;
