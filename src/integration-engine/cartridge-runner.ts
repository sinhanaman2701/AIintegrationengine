// ============================================================================
// Integration Engine — Cartridge Runner (Sandbox)
// ============================================================================
// Loads cartridge files and executes their pure functions in a sandboxed
// environment. Does NOT make HTTP calls or coordinate the pipeline.
//
// Sandbox constraints (POC):
//   - Timeout enforcement on all cartridge function executions
//   - Cartridge functions are pure: input → output, no side effects
//
// In production, this would use Node.js VM2 or isolated-vm for true isolation.
// For the POC, we use a timeout wrapper to demonstrate the pattern.
// ============================================================================

import type { VendorCartridge, SandboxOptions } from "./types.js";
import { IntegrationError, IntegrationErrorType } from "./errors.js";

// In-memory cartridge registry — cartridges are registered at startup
const cartridgeRegistry: Map<string, VendorCartridge> = new Map();

export class CartridgeRunner {
    /**
     * Registers a cartridge so it can be loaded by ID.
     * In production, this would load from filesystem or database.
     */
    static register(cartridge: VendorCartridge): void {
        cartridgeRegistry.set(cartridge.id, cartridge);
        console.log(
            `[CartridgeRunner] Registered cartridge: ${cartridge.id} v${cartridge.version}`
        );
    }

    /**
     * Loads a cartridge by its ID.
     *
     * @param cartridgeId - The cartridge identifier (e.g., "neptune_ems")
     * @returns The loaded VendorCartridge
     * @throws IntegrationError if cartridge is not found
     */
    load(cartridgeId: string): VendorCartridge {
        const cartridge = cartridgeRegistry.get(cartridgeId);

        if (!cartridge) {
            throw new IntegrationError(
                IntegrationErrorType.CARTRIDGE_LOAD_FAILED,
                `Cartridge "${cartridgeId}" not found. Available: [${Array.from(cartridgeRegistry.keys()).join(", ")}]`,
                { retryable: false }
            );
        }

        return cartridge;
    }

    /**
     * Executes a cartridge function within a sandboxed environment.
     * Enforces timeout to prevent infinite loops or slow transformations.
     *
     * @param fn       - The cartridge function to execute (buildRequest or transformResponse)
     * @param options  - Sandbox options (timeout)
     * @returns The result of the cartridge function
     * @throws IntegrationError if execution times out or throws
     */
    sandboxExec<T>(fn: () => T, options: SandboxOptions): T {
        const { timeout } = options;
        const startTime = Date.now();

        try {
            // For the POC, we execute synchronously and check time after.
            // In production, this would use a worker thread or VM with hard timeout.
            const result = fn();

            const elapsed = Date.now() - startTime;
            if (elapsed > timeout) {
                throw new IntegrationError(
                    IntegrationErrorType.TRANSFORM_FAILED,
                    `Cartridge function execution exceeded timeout: ${elapsed}ms > ${timeout}ms`,
                    { retryable: false }
                );
            }

            return result;
        } catch (error) {
            if (error instanceof IntegrationError) {
                throw error;
            }

            throw new IntegrationError(
                IntegrationErrorType.TRANSFORM_FAILED,
                `Cartridge function threw an error: ${error instanceof Error ? error.message : String(error)}`,
                { retryable: false }
            );
        }
    }

    /**
     * Clears all registered cartridges. Useful for testing.
     */
    static clearRegistry(): void {
        cartridgeRegistry.clear();
    }
}
