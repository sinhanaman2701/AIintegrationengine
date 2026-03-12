---
description: integrate a new vendor api based on the standard operating procedure
---

# 10-Step Vendor Integration SOP

This workflow MUST be followed religiously for every single vendor integration. Do not skip any steps.

> **MANDATORY FIRST ACTION:** Before doing ANYTHING else, create a `task.md` artifact that **exactly mirrors** the 10 steps below with their exact numbering (not a reinterpretation). Mark each step `[x]` only AFTER it is fully complete and confirmed. This gives the PM a visible progress tracker.

---

### PHASE 1: Discovery & Validation

// turbo
1. Request API Docs from the PM (unless already provided). Initialize a `pr_payload.md` file in the root directory to act as an ongoing integration log for the final Pull Request.

// turbo
2. Validate the provided documentation against: Base URL, Auth Method, JSON Examples, Error Codes, and Rate Limits. If any are missing, STOP and ask the PM. Appending the discovered Rate Limits and Error Codes to `pr_payload.md` for the Software Engineer.

// turbo
3. Test all endpoints yourself using `curl`. If you encounter any connection errors, 404s, or bad requests, look back at the API documentation provided, fix the error, and test again. Only when the endpoints successfully resolve and you have a green light should you generate a Postman Collection (`.json`) for the raw Vendor API and provide it to the PM for testing.

4. Wait for the PM to provide the real, live JSON responses from their Postman testing.
⛔ **HARD STOP: Do NOT proceed to Step 5 until the PM has pasted the actual raw JSON response in chat. "It's working" is NOT sufficient — the raw JSON must be present in the conversation.**

---

### PHASE 2: Implementation & Local PM Testing

// turbo
5. Run `git pull origin main` to ensure the core engine and superschemas are up to date.
⛔ **HARD STOP: Report the exact result of the git pull to the PM (e.g. "Already up to date" or list of changed files) before proceeding to Step 6.**

6. Perform Harmless Gap Analysis: Map the *real* JSON responses from Step 4 to the current Superschema. Explicitly list any *extra* vendor fields (harmless gaps) and ask the PM for approval of the mapping table. Append the required Database mapping instructions to `pr_payload.md`.

7. Wait for PM approval on the mapping table.
⛔ **HARD STOP: Do NOT proceed to Step 8 until the PM has explicitly typed "approved" or clear equivalent confirmation. Do NOT interpret silence, "looks good", or "it's working" as approval of the mapping.**

// turbo
8. Write the Cartridge code (`src/cartridges/domain/vendor.ts`). **CRITICAL RULE:** For `buildRequest`, you MUST strictly copy the exact headers, body, and URL structure from the PM's verified Postman collection (Step 4) as the absolute ground truth, explicitly overriding any original documentation if they conflict. DO NOT MAKE HTTP CALLS in the cartridge.

// turbo
9. Update the local environment for testing: Insert a dummy row in `src/mock-data/mock-database.ts` (e.g., `unit_id: 999` to `new_vendor`). Do NOT add rate limit config to `vendor-rules.ts` (let it fall back to default safely).

10. Instruct the PM to start the local server (`npm run dev`) and test the endpoint end-to-end via their web browser using the dummy unit ID. **Before writing these instructions, you MUST look at the PM's working Postman collection (Step 4) to ensure you provide the correct dummy test `unit_id` and credentials that actually exist on the vendor's side.** Provide explicit, copy-pasteable instructions to the PM every time:
    - 1. The exact command to start the server (`npm run dev`).
    - 2. The exact URL to open in their browser (e.g., `http://localhost:3000/api/integration/electricity/getMeterBalance?unit_id=XXX`).
    - 3. The exact expected successful JSON output matching the Superschema.
    - 4. The exact expected error JSON output if the vendor simulator fails.

⛔ **HARD STOP: Do NOT proceed to Phase 3 until the PM has explicitly confirmed that local tests passed.**

---

### PHASE 3: Hand-off & Merge

11. Wait for PM to confirm the local tests passed.

// turbo
12. Review the running `pr_payload.md` log, format it cleanly into a Pull Request description. Revert the dummy database mapping before committing. Commit **ONLY THE CARTRIDGE**.
    > ⛔ **CRITICAL RULE:** You MUST push the branch to the remote repository (`git push -u origin feature/branch-name`) immediately after committing. You MUST provide the PM with the direct GitHub link to open the Pull Request.
    Use the `pr_payload.md` text as the PR description to explicitly instruct the Software Engineer to update `vendor-rules.ts` and the Production Database mappings. After the Pull Request is pushed, delete the local `pr_payload.md` file.
