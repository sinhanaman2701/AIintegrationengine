// ============================================================================
// Integration Engine — Orchestrator
// ============================================================================
// The central coordinator of the engine pipeline.
// Owns the 7-step execution flow but contains no business logic itself.
// All sub-components are injected and remain independent of each other.
// ============================================================================

import type { IntegrationRequest, IntegrationResponse } from "./types.js";
import { IntegrationError, IntegrationErrorType } from "./errors.js";

import type { Router } from "./router.js";
import type { RulesEngine } from "./rules-engine.js";
import type { HttpExecutor } from "./http-executor.js";
import type { CartridgeRunner } from "./cartridge-runner.js";
import type { SchemaValidator } from "./schema-validator.js";

export class Orchestrator {
    constructor(
        private router: Router,
        private rulesEngine: RulesEngine,
        private cartridgeRunner: CartridgeRunner,
        private httpExecutor: HttpExecutor,
        private schemaValidator: SchemaValidator
    ) { }

    /**
     * Executes the full integration pipeline.
     *
     * @param request - The incoming operation request
     * @returns Success response with validated data
     * @throws IntegrationError on any failure in the pipeline
     */
    async execute(request: IntegrationRequest): Promise<IntegrationResponse> {
        const { feature, entityId, operation, params } = request;
        console.log(`\n[Orchestrator] Starting: ${feature}:${operation} for entity ${entityId}`);

        try {
            // ── Step 1: Route ──
            const routing = await this.router.resolve(feature, entityId);
            console.log(`[Orchestrator] Routed to vendor: ${routing.vendorId}`);

            // ── Step 2: Pre-check Rules ──
            // Validates rate limits and circuit breaker state. Throws if blocked.
            await this.rulesEngine.preCheck(routing.vendorId);
            console.log(`[Orchestrator] Rules check passed`);

            // ── Step 3: Build Vendor Request ──
            // Load the cartridge and execute buildRequest in the sandbox
            const cartridge = this.cartridgeRunner.load(routing.cartridgeId);
            const cartridgeOp = cartridge.operations[operation];

            if (!cartridgeOp) {
                throw new IntegrationError(
                    IntegrationErrorType.CARTRIDGE_LOAD_FAILED,
                    `Cartridge "${routing.cartridgeId}" does not support operation "${operation}"`,
                    { retryable: false }
                );
            }

            console.log(`[Orchestrator] Building vendor request`);
            const vendorRequest = this.cartridgeRunner.sandboxExec(
                () =>
                    cartridgeOp.buildRequest({
                        entityId,
                        vendorEntityId: routing.vendorEntityId,
                        credentials: routing.credentials,
                        params,
                    }),
                { timeout: 2000 }
            );

            // ── Step 4: Execute HTTP ──
            // rulesEngine.executeWithRetry wraps the HTTP call, enforcing retry logic
            // and updating the circuit breaker on success/failure
            console.log(`[Orchestrator] Executing HTTP with retry wrapping`);
            const rawResponse = await this.rulesEngine.executeWithRetry(
                routing.vendorId,
                async () => {
                    return this.httpExecutor.execute({
                        ...vendorRequest,
                        ...cartridgeOp.request,
                        // We use a fixed 5s timeout for the POC per the spec
                        timeout: 5000,
                    });
                }
            );

            // ── Step 5: Transform Response ──
            console.log(`[Orchestrator] Transforming vendor response`);
            const transformed = this.cartridgeRunner.sandboxExec(
                () => cartridgeOp.transformResponse(rawResponse.data),
                { timeout: 2000 }
            );

            // ── Step 6: Validate Output ──
            console.log(`[Orchestrator] Validating against superschema`);
            const validated = this.schemaValidator.validate(
                feature,
                operation,
                transformed
            );

            // ── Step 7: Return ──
            console.log(`[Orchestrator] Pipeline complete. Success.`);
            return {
                success: true,
                data: validated,
            };
        } catch (error) {
            if (error instanceof IntegrationError) {
                throw error;
            }

            // Wrap unexpected errors
            throw new IntegrationError(
                IntegrationErrorType.UNKNOWN,
                `Unexpected orchestration failure: ${error instanceof Error ? error.message : String(error)}`,
                { retryable: false }
            );
        }
    }
}
