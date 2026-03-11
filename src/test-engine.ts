import { Router } from "./integration-engine/router.js";
import { RulesEngine } from "./integration-engine/rules-engine.js";
import { HttpExecutor } from "./integration-engine/http-executor.js";
import { CartridgeRunner } from "./integration-engine/cartridge-runner.js";
import { SchemaValidator } from "./integration-engine/schema-validator.js";
import { Orchestrator } from "./integration-engine/orchestrator.js";
import { IntegrationErrorType, IntegrationError } from "./integration-engine/errors.js";
import type { VendorCartridge, IntegrationRequest } from "./integration-engine/types.js";

// ============================================================================
// Test Setup
// ============================================================================

const router = new Router();
const rulesEngine = new RulesEngine();
const cartridgeRunner = new CartridgeRunner();
const httpExecutor = new HttpExecutor();
const schemaValidator = new SchemaValidator();

const orchestrator = new Orchestrator(
    router,
    rulesEngine,
    cartridgeRunner,
    httpExecutor,
    schemaValidator
);

// The test vendor from our mock database
const TEST_VENDOR = "neptune_ems";
const TEST_UNIT = 101; // Maps to neptune_ems

// Base request
const req: IntegrationRequest = {
    feature: "electricity",
    operation: "getMeterBalance",
    entityId: TEST_UNIT,
    params: {},
};

// ============================================================================
// Mock Cartridge (Registers itself)
// ============================================================================

const mockCartridge: VendorCartridge = {
    id: TEST_VENDOR,
    vendor: "Mock Neptune",
    feature: "electricity",
    version: "1.0",
    operations: {
        getMeterBalance: {
            request: {
                method: "GET",
                baseUrl: "https://mock-api.local",
                path: "/meters/{meter_id}/balance",
                headers: {},
                authType: "none",
            },
            buildRequest: (params) => {
                return {
                    url: `https://mock-api.local/meters/${params.vendorEntityId}/balance`,
                    headers: { "X-Api-Key": params.credentials.api_key || "" },
                };
            },
            transformResponse: (raw: any) => ({
                meter_id: raw.CA_ADDRESS,
                meter_balance: parseFloat(raw.CURRENT_BALANCE),
            }),
            errorMap: {},
        },
    },
};

CartridgeRunner.register(mockCartridge);

// ============================================================================
// Mock HTTP Executor (Intercepts calls instead of making real ones)
// ============================================================================
let mockExecutionCount = 0;
let mockResponseBehavior: "success" | "fail_500" | "timeout" | "bad_schema" = "success";

httpExecutor.execute = async (req) => {
    mockExecutionCount++;
    console.log(`  [Mock Network] Intercepted call #${mockExecutionCount} to ${req.url}`);

    if (mockResponseBehavior === "timeout") {
        throw new IntegrationError(IntegrationErrorType.TIMEOUT, "Mock timeout", { retryable: true });
    }

    if (mockResponseBehavior === "fail_500") {
        throw new IntegrationError(IntegrationErrorType.VENDOR_SERVER_ERROR, "Mock 500 error", { retryable: true });
    }

    if (mockResponseBehavior === "bad_schema") {
        return {
            status: 200,
            headers: {},
            data: {
                CA_ADDRESS: "METER-101-NEPTUNE",
                CURRENT_BALANCE: "i_am_not_a_number", // Will fail schema validation
            },
        };
    }

    // Success
    return {
        status: 200,
        headers: {},
        data: {
            CA_ADDRESS: "METER-101-NEPTUNE",
            CURRENT_BALANCE: "142.50",
        },
    };
};

// ============================================================================
// Test Runners
// ============================================================================

async function runTest(name: string, fn: () => Promise<void>) {
    console.log(`\n=============================================`);
    console.log(`🧪 TEST: ${name}`);
    console.log(`=============================================`);

    rulesEngine.reset();
    mockExecutionCount = 0;
    mockResponseBehavior = "success";

    try {
        await fn();
        console.log(`✅ PASS: ${name}`);
    } catch (error) {
        console.error(`❌ FAIL: ${name}`);
        console.error(error);
        process.exit(1);
    }
}

async function main() {
    console.log("\n🚀 Starting Integration Engine POC Verification...\n");

    // TEST 1: Happy Path
    await runTest("Happy Path Execution", async () => {
        const res = await orchestrator.execute(req);

        if (!res.success) throw new Error("Expected success: true");
        if (res.data.meter_id !== "METER-101-NEPTUNE") throw new Error("Wrong ID");
        if (res.data.meter_balance !== 142.5) throw new Error("Wrong balance");
        if (mockExecutionCount !== 1) throw new Error("Expected 1 network call");
    });

    // TEST 2: Schema Validation
    await runTest("Schema Validation Failure", async () => {
        mockResponseBehavior = "bad_schema";

        try {
            await orchestrator.execute(req);
            throw new Error("Expected pipeline to throw schema error");
        } catch (e: any) {
            if (e.type !== IntegrationErrorType.SCHEMA_VALIDATION_FAILED) {
                throw new Error(`Expected SCHEMA_VALIDATION_FAILED, got ${e.type}`);
            }
            console.log(`   Caught expected schema error: ${e.message}`);
        }
    });

    // TEST 3: Retries
    await runTest("Retry Policy (500 Error)", async () => {
        mockResponseBehavior = "fail_500";

        try {
            await orchestrator.execute(req);
            throw new Error("Expected pipeline to throw 500 error after retries");
        } catch (e: any) {
            if (e.type !== IntegrationErrorType.VENDOR_SERVER_ERROR) {
                throw new Error(`Expected VENDOR_SERVER_ERROR, got ${e.type}`);
            }
            // Should attempt 1 initial + 2 retries = 3 calls
            if (mockExecutionCount !== 3) {
                throw new Error(`Expected 3 network calls (1 + 2 retries), got ${mockExecutionCount}`);
            }
            console.log(`   Verified ${mockExecutionCount} network calls were made.`);
        }
    });

    // TEST 4: Rate Limiting
    await runTest("Rate Limiter (10 calls/10 min)", async () => {
        mockResponseBehavior = "success";

        // Make 10 successful calls
        for (let i = 0; i < 10; i++) {
            await orchestrator.execute(req);
        }

        // The 11th should fail
        try {
            await orchestrator.execute(req);
            throw new Error("Expected 11th call to be rate limited");
        } catch (e: any) {
            if (e.type !== IntegrationErrorType.RATE_LIMIT_EXCEEDED) {
                throw new Error(`Expected RATE_LIMIT_EXCEEDED, got ${e.type}`);
            }
            console.log(`   Caught expected rate limit: ${e.message}`);
        }
    });

    // TEST 5: Circuit Breaker
    await runTest("Circuit Breaker trips after 5 failures", async () => {
        mockResponseBehavior = "timeout";

        // Make 5 failing calls (each fails 3 times due to retries, 
        // but the Orchestrator call itself fails 5 times)
        for (let i = 0; i < 5; i++) {
            try {
                await orchestrator.execute(req);
            } catch (e) {
                // Expected timeout failure
            }
        }

        // Circuit should now explicitly be OPEN
        try {
            await orchestrator.execute(req);
            throw new Error("Expected call to be fast-failed by circuit breaker");
        } catch (e: any) {
            if (e.type !== IntegrationErrorType.CIRCUIT_OPEN) {
                throw new Error(`Expected CIRCUIT_OPEN, got ${e.type}`);
            }
            console.log(`   Caught expected circuit breaker open block: ${e.message}`);
        }
    });

    console.log(`\n🎉 ALL TESTS PASSED! The Integration Engine POC is rock solid.`);
}

main().catch(console.error);
