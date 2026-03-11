import express from "express";
import { Router } from "./integration-engine/router.js";
import { RulesEngine } from "./integration-engine/rules-engine.js";
import { HttpExecutor } from "./integration-engine/http-executor.js";
import { CartridgeRunner } from "./integration-engine/cartridge-runner.js";
import { SchemaValidator } from "./integration-engine/schema-validator.js";
import { Orchestrator } from "./integration-engine/orchestrator.js";
import { IntegrationError } from "./integration-engine/errors.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// ── Initialize Engine Components ──
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

// ── REST API Endpoint ──
// Example call: GET /api/integration/electricity/getMeterBalance?unit_id=101

app.get("/api/integration/:feature/:operation", async (req, res) => {
    try {
        const { feature, operation } = req.params;
        const { unit_id, ...otherParams } = req.query;

        if (!unit_id) {
            return res.status(400).json({
                success: false,
                error: "Missing required query parameter: unit_id",
            });
        }

        const entityId = parseInt(unit_id as string, 10);

        // Call the engine
        const result = await orchestrator.execute({
            feature,
            operation,
            entityId,
            params: otherParams,
        });

        return res.json(result);
    } catch (error) {
        if (error instanceof IntegrationError) {
            // Return 429 for rate limit/circuit open, 502 for vendor issues, 400 for bad requests
            const status = error.retryable ? 429 : 500;
            return res.status(status).json(error.toResponse());
        }

        console.error("Unhandled Server Error:", error);
        return res.status(500).json({
            success: false,
            error: {
                type: "UNKNOWN",
                message: "An unexpected server error occurred",
                retryable: false,
            },
        });
    }
});

app.listen(port, () => {
    console.log(`\n🚀 Integration Engine Engine running on http://localhost:${port}`);
    console.log(`Test with: curl "http://localhost:${port}/api/integration/electricity/getMeterBalance?unit_id=101"`);
    console.log(`(Note: Testing via server requires a registered cartridge)`);
});
