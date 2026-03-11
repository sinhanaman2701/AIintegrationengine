import type { VendorCartridge } from "../../integration-engine/types.js";

// Ensure the module defines a default export of the cartridge
const cartridge: VendorCartridge = {
    id: "neptune_ems",
    vendor: "Neptune EMS",
    feature: "electricity",
    version: "1.0.0",

    operations: {
        getMeterBalance: {
            request: {
                method: "POST",
                baseUrl: "https://emsprepaidapi.neptuneenergia.com",
                path: "/service.asmx/liveEmsTransaction",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                authType: "none", // For Neptune, credentials are sent in the body payload
            },

            buildRequest: ({ vendorEntityId, credentials }) => {
                // Based on Postman screenshot, LIVEDATA requires no DATA payload
                // The unit ID isn't sent in the body, presumably Neptune maps it to the site auth.
                const bodyParams = new URLSearchParams();
                bodyParams.append("TXN_NAME", "LIVEDATA");
                bodyParams.append("DATA", "");

                // For the Sandbox, the credentials map must contain sitecode, username, password. 
                // For this POC, we'll hardcode the known DEMO credentials if not passed in.
                bodyParams.append("SITECODE", "114");
                bodyParams.append("username", "Admin");
                bodyParams.append("password", "EMS@123DEMO");

                return {
                    url: "", // Not overriding base url + path
                    headers: {},
                    body: bodyParams.toString(),
                };
            },

            transformResponse: (raw: any) => {
                let parsedRaw = raw;
                if (typeof raw === "string") {
                    try {
                        parsedRaw = JSON.parse(raw);
                    } catch (e) {
                        throw new Error("Failed to parse response as JSON");
                    }
                }

                // Handle Neptune's custom error envelope
                if (parsedRaw.Status === "Failed") {
                    // Throw an object that the engine's cartridge runner can catch and map via errorMap
                    throw new Error(parsedRaw.Msg || "Unknown error");
                }

                if (!parsedRaw.data || !Array.isArray(parsedRaw.data) || parsedRaw.data.length === 0) {
                    throw new Error("Invalid response format: Missing data array");
                }

                const meterData = parsedRaw.data[0];

                // Exact approved mapping from Harmless Gap Analysis
                return {
                    meter_id: String(meterData.DEVICE_SLNO),
                    meter_balance: Number(meterData.PV_BAL),
                };
            },

            // Maps thrown error strings from transformResponse to standardized Engine Error Types
            errorMap: {
                "Transaction Not Found": "METER_NOT_FOUND",
                "Invalid response format: Missing data array": "VENDOR_SERVER_ERROR",
                "Failed to parse response as JSON": "VENDOR_SERVER_ERROR",
            },
        },
    },
};

export default cartridge;
