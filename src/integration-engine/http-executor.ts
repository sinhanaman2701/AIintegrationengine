// ============================================================================
// Integration Engine — HTTP Executor
// ============================================================================
// The ONLY component that makes outbound HTTP(s) requests.
// Accepts a fully constructed request, enforces timeout, returns raw response.
// Zero vendor-specific logic.
// ============================================================================

import type { HttpRequest, HttpResponse } from "./types.js";
import { IntegrationError, IntegrationErrorType } from "./errors.js";

export class HttpExecutor {
    /**
     * Executes an HTTP request with timeout enforcement.
     *
     * @param request - Fully constructed HTTP request
     * @returns Raw response data from the vendor
     * @throws IntegrationError on timeout, network failure, or server error
     */
    async execute(request: HttpRequest): Promise<HttpResponse> {
        const { url, method, headers, queryParams, body, timeout } = request;

        // Build URL with query params
        const fullUrl = this.buildUrl(url, queryParams);

        // Set up timeout via AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            console.log(`[HttpExecutor] ${method} ${fullUrl} (timeout: ${timeout}ms)`);

            const response = await fetch(fullUrl, {
                method,
                headers,
                body,
                signal: controller.signal,
            });

            // Parse response
            const contentType = response.headers.get("content-type") ?? "";
            let data: unknown;

            if (contentType.includes("application/json")) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            // Extract response headers
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            // Handle HTTP error status codes
            if (!response.ok) {
                const errorMessage =
                    typeof data === "object" && data !== null
                        ? JSON.stringify(data)
                        : String(data);

                throw new IntegrationError(
                    response.status >= 500
                        ? IntegrationErrorType.VENDOR_SERVER_ERROR
                        : response.status === 401 || response.status === 403
                            ? IntegrationErrorType.AUTH_FAILED
                            : response.status === 429
                                ? IntegrationErrorType.VENDOR_RATE_LIMITED
                                : IntegrationErrorType.UNKNOWN,
                    `Vendor API returned ${response.status}: ${errorMessage}`,
                    {
                        retryable: response.status >= 500 || response.status === 429,
                    }
                );
            }

            return {
                status: response.status,
                data,
                headers: responseHeaders,
            };
        } catch (error) {
            if (error instanceof IntegrationError) {
                throw error;
            }

            // Handle abort/timeout
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new IntegrationError(
                    IntegrationErrorType.TIMEOUT,
                    `Request to ${fullUrl} timed out after ${timeout}ms`,
                    { retryable: true }
                );
            }

            // Handle network errors
            throw new IntegrationError(
                IntegrationErrorType.UNKNOWN,
                `Network error calling ${fullUrl}: ${error instanceof Error ? error.message : String(error)}`,
                { retryable: true }
            );
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Builds a URL with query parameters appended.
     */
    private buildUrl(
        baseUrl: string,
        queryParams?: Record<string, string>
    ): string {
        if (!queryParams || Object.keys(queryParams).length === 0) {
            return baseUrl;
        }

        const url = new URL(baseUrl);
        for (const [key, value] of Object.entries(queryParams)) {
            url.searchParams.set(key, value);
        }
        return url.toString();
    }
}
