---
description: integrate a new vendor api based on the standard operating procedure
---

# 10-Step Vendor Integration SOP

This workflow MUST be followed religiously for every single vendor integration. Do not skip any steps.

### PHASE 1: Discovery & Validation

// turbo
1. Request API Docs from the PM (unless already provided).
2. Validate the provided documentation against: Base URL, Auth Method, JSON Examples, Error Codes, and Rate Limits. If any are missing, STOP and ask the PM.
3. Generate a Postman Collection (`.json`) for the raw Vendor API so the PM can verify it. Ask the PM to test it and provide real JSON responses.
4. Wait for the PM to provide the real, live JSON responses from their Postman testing.

### PHASE 2: Implementation & Local PM Testing

// turbo
5. Run `git pull origin main` to ensure the core engine and superschemas are up to date.
6. Perform Harmless Gap Analysis: Map the *real* JSON responses from Step 4 to the current Superschema. Explicitly list any *extra* vendor fields (harmless gaps) and ask the PM for approval of the mapping table.
7. Wait for PM approval on the mapping table.
// turbo
8. Write the Cartridge code (`src/cartridges/domain/vendor.ts`). DO NOT MAKE HTTP CALLS in the cartridge.
// turbo
9. Update the local environment for testing: Insert a dummy row in `src/mock-data/mock-database.ts` (e.g., `unit_id: 999` to `new_vendor`) and add basic rate limit config to `src/config/vendor-rules.ts`.
10. Instruct the PM to start the local server (`npm run dev`) and test the endpoint end-to-end via Postman using the dummy unit ID.

### PHASE 3: Hand-off & Merge

11. Wait for PM to confirm the local tests passed.
// turbo
12. Raise a Pull Request (or instruct the PM on how to do so) containing **ONLY THE CARTRIDGE**. Revert the dummy database mapping before committing. Leave explicit instructions in the PR description for the Software Engineer to update `vendor-rules.ts` and the Production Database mappings.
