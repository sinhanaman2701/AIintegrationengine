---
description: integrate a new vendor api based on the standard operating procedure
---

# 10-Step Vendor Integration SOP

This workflow MUST be followed religiously for every single vendor integration. Do not skip any steps.

### PHASE 1: Discovery & Validation

// turbo
1. Request API Docs from the PM (unless already provided). Initialize a `pr_payload.md` file in the root directory to act as an ongoing integration log for the final Pull Request.
2. Validate the provided documentation against: Base URL, Auth Method, JSON Examples, Error Codes, and Rate Limits. If any are missing, STOP and ask the PM. Appending the discovered Rate Limits and Error Codes to `pr_payload.md` for the Software Engineer.
3. Generate a Postman Collection (`.json`) for the raw Vendor API so the PM can verify it. Ask the PM to test it and provide real JSON responses.
4. Wait for the PM to provide the real, live JSON responses from their Postman testing.

### PHASE 2: Implementation & Local PM Testing

// turbo
5. Run `git pull origin main` to ensure the core engine and superschemas are up to date.
6. Perform Harmless Gap Analysis: Map the *real* JSON responses from Step 4 to the current Superschema. Explicitly list any *extra* vendor fields (harmless gaps) and ask the PM for approval of the mapping table. Append the required Database mapping instructions to `pr_payload.md`.
7. Wait for PM approval on the mapping table.
// turbo
8. Write the Cartridge code (`src/cartridges/domain/vendor.ts`). **CRITICAL RULE:** For `buildRequest`, you MUST strictly copy the exact headers, body, and URL structure from the PM's verified Postman collection (Step 4) as the absolute ground truth, explicitly overriding any original documentation if they conflict. DO NOT MAKE HTTP CALLS in the cartridge.
// turbo
9. Update the local environment for testing: Insert a dummy row in `src/mock-data/mock-database.ts` (e.g., `unit_id: 999` to `new_vendor`). Do NOT add rate limit config to `vendor-rules.ts` (let it fall back to default safely).
10. Instruct the PM to start the local server (`npm run dev`) and test the endpoint end-to-end via their web browser using the dummy unit ID. **Before writing these instructions, you MUST look at the PM's working Postman collection (Step 4) to ensure you provide the correct dummy test `unit_id` and credentials that actually exist on the vendor's side.** Provide explicit, copy-pasteable instructions to the PM every time:
    - 1. The exact command to start the server (`npm run dev`).
    - 2. The exact URL to open in their browser (e.g., `http://localhost:3000/api/integration/electricity/getMeterBalance?unit_id=XXX`).
    - 3. The exact expected successful JSON output matching the Superschema.
    - 4. The exact expected error JSON output if the vendor simulator fails.

### PHASE 3: Hand-off & Merge

11. Wait for PM to confirm the local tests passed.
// turbo
12. Review the running `pr_payload.md` log, format it cleanly into a Pull Request description. Raise a Pull Request containing **ONLY THE CARTRIDGE**. Revert the dummy database mapping before committing. Use the `pr_payload.md` text as the PR description to explicitly instruct the Software Engineer to update `vendor-rules.ts` and the Production Database mappings. After the Pull Request is raised, delete the local `pr_payload.md` file.
