// ============================================================================
// Integration Engine — Rules Engine
// ============================================================================
// Enforces all stateful infrastructure rules:
//   - Rate Limiting:    10 calls per 10 minutes per vendor (in-memory)
//   - Circuit Breaker:  Starts CLOSED, trips after 5 failures, 30s cooldown
//   - Retry:            2 retries with exponential backoff
//   - No caching in POC
// ============================================================================

import { IntegrationError, IntegrationErrorType } from "./errors.js";
import type { VendorEngineRules } from "./types.js";
import { getVendorRules } from "../config/vendor-rules.js";

// ── Circuit Breaker States ──
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerState {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
    lastStateChange: number;
}

export class RulesEngine {
    // In-memory rate limit storage: vendorId → array of request timestamps
    private rateLimitCounters: Map<string, number[]> = new Map();

    // In-memory circuit breaker state: vendorId → state
    private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

    /**
     * Pre-check: validates rate limit and circuit breaker BEFORE executing a request.
     * Throws IntegrationError if the request should be blocked.
     */
    async preCheck(vendorId: string): Promise<void> {
        this.checkRateLimit(vendorId);
        this.checkCircuitBreaker(vendorId);
    }

    /**
     * Executes an async function with retry logic (exponential backoff).
     * Also records successes/failures for the circuit breaker.
     */
    async executeWithRetry<T>(
        vendorId: string,
        fn: () => Promise<T>
    ): Promise<T> {
        const rules = getVendorRules(vendorId);
        const maxAttempts = rules.retry.maxRetries + 1; // 2 retries = 3 attempts

        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await fn();
                this.recordSuccess(vendorId);
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.recordFailure(vendorId);

                console.log(
                    `[RulesEngine] Attempt ${attempt}/${maxAttempts} failed for vendor "${vendorId}": ${lastError.message}`
                );

                // Don't retry if it's a non-retryable error
                if (error instanceof IntegrationError && !error.retryable) {
                    throw error;
                }

                // Don't wait after the last attempt
                if (attempt < maxAttempts) {
                    const delay = this.calculateBackoff(attempt, rules);
                    console.log(
                        `[RulesEngine] Retrying in ${delay}ms...`
                    );
                    await this.sleep(delay);
                }
            }
        }

        // All attempts exhausted
        throw (
            lastError ??
            new IntegrationError(
                IntegrationErrorType.UNKNOWN,
                "All retry attempts exhausted",
                { retryable: false, vendor: vendorId }
            )
        );
    }

    // ── Rate Limiting (Sliding Window, In-Memory) ──

    private checkRateLimit(vendorId: string): void {
        const rules = getVendorRules(vendorId);
        const now = Date.now();
        const windowStart = now - rules.rateLimit.windowMs;

        // Get or create counter
        let timestamps = this.rateLimitCounters.get(vendorId) ?? [];

        // Remove entries outside the window
        timestamps = timestamps.filter((t) => t > windowStart);
        this.rateLimitCounters.set(vendorId, timestamps);

        // Check if limit exceeded
        if (timestamps.length >= rules.rateLimit.maxRequests) {
            const oldestInWindow = timestamps[0]!;
            const retryAfterMs = oldestInWindow + rules.rateLimit.windowMs - now;

            throw new IntegrationError(
                IntegrationErrorType.RATE_LIMIT_EXCEEDED,
                `Rate limit exceeded for vendor "${vendorId}": ${timestamps.length}/${rules.rateLimit.maxRequests} requests in ${rules.rateLimit.windowMs / 1000}s window`,
                { retryable: true, vendor: vendorId, retryAfterMs }
            );
        }

        // Record this request
        timestamps.push(now);
    }

    // ── Circuit Breaker (State Machine, In-Memory) ──

    private getCircuitState(vendorId: string): CircuitBreakerState {
        if (!this.circuitBreakers.has(vendorId)) {
            this.circuitBreakers.set(vendorId, {
                state: "CLOSED",
                failureCount: 0,
                lastFailureTime: 0,
                lastStateChange: Date.now(),
            });
        }
        return this.circuitBreakers.get(vendorId)!;
    }

    private checkCircuitBreaker(vendorId: string): void {
        const circuit = this.getCircuitState(vendorId);
        const rules = getVendorRules(vendorId);

        if (circuit.state === "OPEN") {
            const elapsed = Date.now() - circuit.lastStateChange;

            if (elapsed >= rules.circuitBreaker.cooldownMs) {
                // Cooldown elapsed → move to HALF_OPEN (allow one test request)
                circuit.state = "HALF_OPEN";
                circuit.lastStateChange = Date.now();
                console.log(
                    `[RulesEngine] Circuit breaker for "${vendorId}": OPEN → HALF_OPEN (cooldown elapsed)`
                );
            } else {
                throw new IntegrationError(
                    IntegrationErrorType.CIRCUIT_OPEN,
                    `Circuit breaker is OPEN for vendor "${vendorId}". Retry after ${rules.circuitBreaker.cooldownMs - elapsed}ms`,
                    {
                        retryable: true,
                        vendor: vendorId,
                        retryAfterMs: rules.circuitBreaker.cooldownMs - elapsed,
                    }
                );
            }
        }
        // CLOSED and HALF_OPEN both allow requests through
    }

    private recordSuccess(vendorId: string): void {
        const circuit = this.getCircuitState(vendorId);

        if (circuit.state === "HALF_OPEN") {
            // Test request succeeded → close the circuit
            circuit.state = "CLOSED";
            circuit.failureCount = 0;
            circuit.lastStateChange = Date.now();
            console.log(
                `[RulesEngine] Circuit breaker for "${vendorId}": HALF_OPEN → CLOSED (success)`
            );
        } else if (circuit.state === "CLOSED") {
            // Reset failure count on success
            circuit.failureCount = 0;
        }
    }

    private recordFailure(vendorId: string): void {
        const circuit = this.getCircuitState(vendorId);
        const rules = getVendorRules(vendorId);

        circuit.failureCount++;
        circuit.lastFailureTime = Date.now();

        if (circuit.state === "HALF_OPEN") {
            // Test request failed → back to OPEN
            circuit.state = "OPEN";
            circuit.lastStateChange = Date.now();
            console.log(
                `[RulesEngine] Circuit breaker for "${vendorId}": HALF_OPEN → OPEN (test failed)`
            );
        } else if (
            circuit.state === "CLOSED" &&
            circuit.failureCount >= rules.circuitBreaker.failureThreshold
        ) {
            // Threshold reached → trip to OPEN
            circuit.state = "OPEN";
            circuit.lastStateChange = Date.now();
            console.log(
                `[RulesEngine] Circuit breaker for "${vendorId}": CLOSED → OPEN (${circuit.failureCount} consecutive failures)`
            );
        }
    }

    // ── Helpers ──

    private calculateBackoff(attempt: number, rules: VendorEngineRules): number {
        // Exponential backoff: baseDelay * 2^(attempt-1), capped at maxDelay
        const delay = rules.retry.baseDelayMs * Math.pow(2, attempt - 1);
        return Math.min(delay, rules.retry.maxDelayMs);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Resets all engine state. Useful for testing.
     */
    reset(): void {
        this.rateLimitCounters.clear();
        this.circuitBreakers.clear();
    }
}
