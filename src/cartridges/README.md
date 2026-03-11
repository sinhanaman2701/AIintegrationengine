# Cartridges Directory

This directory is where the **Product Team** implements vendor-specific transformation logic.

**Cartridges are NOT part of the Integration Engine core.** They are isolated, sandboxed configuration files that simply map input to output.

## Structure

```
cartridges/
├── electricity/
│   ├── neptune_ems.ts
│   └── capital_meter.ts
├── parking/
└── ...
```

## How to add a new Vendor (e.g., Elmeasure)

1. Create a new file `electricity/elmeasure.ts`
2. Implement the `VendorCartridge` interface (defining `buildRequest` and `transformResponse`)
3. The Engine's `CartridgeRunner` will load this file dynamically at runtime and execute it securely.
4. **Important**: Cartridges never make HTTP calls. They only return the *definition* of the request for the Engine to execute.
