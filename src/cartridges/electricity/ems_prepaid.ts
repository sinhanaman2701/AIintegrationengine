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
// Mapping (verified and approved by PM 2026-03-13):
//   meter_id      ← DEVICE_SLNO  (The device's serial number)
//   meter_balance ← PV_BAL       (Current prepaid balance as a number)
// ============================================================================

import type { VendorCartridge, BuildRequestParams, VendorRequestOutput } from "../../integration-engine/types.js";

const BASE_URL = "https://emsprepaidapi.neptuneenergia.com/service.asmx/liveEmsTransaction";

// Credentials for demo environment (Hardcoded for POC, would be in DB in prod)
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
                authType: "none", // Auth via form body
            },

            /**
             * buildRequest: Constructs the URLSearchParams for the POST body.
             * The vendor API expects TXN_NAME, DATA (JSON string), and credentials.
             */
            buildRequest: (params: BuildRequestParams): VendorRequestOutput => {
                const caAddress = params.vendorEntityId; // Using ca_address as the direct reference for API

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

            /**
             * transformResponse: Maps the vendor's JSON string/object to the Superschema.
             * meter_id      ← DEVICE_SLNO
             * meter_balance ← PV_BAL
             */
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
                        DEVICE_SLNO: string;
                        PV_BAL: number;
                    }> | null;
                };

                if (raw.Status !== "Success" || !raw.data || raw.data.length === 0) {
                    throw new Error(`EMS Prepaid API error: ${raw.Msg || "Unknown Error"}`);
                }

                const record = raw.data[0];

                return {
                    meter_id: String(record.DEVICE_SLNO),
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
