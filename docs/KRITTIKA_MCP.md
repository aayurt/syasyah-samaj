# Kritikka-MCP Governance

Kritikka-MCP is a Model Context Protocol (MCP) server designed to enforce architectural governance, security constraints, and best practices directly within the codebase context. It validates changes against a set of predefined rules.

## Usage Guide

You can run Kritikka-MCP locally to validate your changes before pushing them or creating a pull request.

### Validate Specific Changes

To validate specific changed files manually:

```bash
npx kritikka-mcp validate-change --changed-files "apps/billing/src/pages/Vouchers.tsx"
```

### CI Validation

Kritikka-MCP is integrated into our GitHub Actions CI pipeline. On every pull request, it runs a validation check using the PR's diff URL:

```bash
npx kritikka-mcp validate-change --diff <PR_DIFF_URL>
```

- **Errors:** If any rule with an `error` severity fails, the CI pipeline will fail, blocking the merge.
- **Warnings:** If rules with a `warning` severity fail, they will be shown in the CI logs but will not block the merge.

## Rule Types (`mcp-rules.json`)

Rules are defined in `mcp-rules.json` at the root of the repository. Here are the supported rule types with examples from our configuration:

### 1. `forbidden`
Forbids specific files or patterns from being committed.

**Example:** Prevent committing generated TypeScript definitions.
```json
{
  "type": "forbidden",
  "id": "no-generated-files",
  "match": [
    "apps/billing/src/**/*.d.ts",
    "apps/billing/src/**/*.generated.ts",
    "apps/billing/payload-types.ts"
  ],
  "reason": "Generated TypeScript definitions should not be committed; they are produced by build/scripts.",
  "severity": "error"
}
```

### 2. `requireTest`
Requires changes in specified source files to be accompanied by corresponding test file changes.

**Example:** Ensure core library functions have unit tests.
```json
{
  "type": "requireTest",
  "id": "lib-core-needs-tests",
  "match": ["apps/billing/src/lib/**/*.ts"],
  "testMatch": ["apps/billing/tests/unit/**/*.test.ts"],
  "severity": "error",
  "reason": "Core library functions (importExport, api, validationSchemas, offlineImport) require unit tests."
}
```

### 3. `requireAdr`
Requires changes in specific files to reference a specific Architecture Decision Record (ADR) in the PR or commit message (or at least brings awareness that the change is governed by an ADR).

**Example:** Data Model Governance for collections.
```json
{
  "type": "requireAdr",
  "id": "collections-governed-by-adr",
  "match": ["apps/billing/src/collections/**"],
  "adr": "0001",
  "severity": "error",
  "reason": "Collection schemas are governed by ADR-0001 (Data Model Governance)."
}
```

### 4. `requireDocUpdate`
Requires updates to specific documentation files when related source files are changed.

**Example:** Keep architecture docs current.
```json
{
  "type": "requireDocUpdate",
  "id": "keep-architecture-docs-current",
  "match": ["apps/billing/src/lib/**", "apps/billing/src/collections/**", "apps/billing/src/pages/**"],
  "docs": ["docs/ARCHITECTURE.md", "docs/SYNC-ARCHITECTURE.md", "apps/billing/docs/"],
  "severity": "warning",
  "reason": "Keep architecture and sync documentation current when changing core patterns."
}
```

### 5. `layerDependency`
Enforces dependency boundaries between different architectural layers to prevent circular dependencies or improper coupling.

**Example:** Prevent UI layer from being imported into the Lib layer.
```json
{
  "type": "layerDependency",
  "id": "no-ui-in-lib",
  "layers": [
    {
      "name": "ui",
      "globs": ["apps/billing/src/pages/**", "apps/billing/src/components/**", "apps/billing/src/hooks/**"]
    },
    {
      "name": "lib",
      "globs": ["apps/billing/src/lib/**"]
    }
  ],
  "direction": "inward-only",
  "reason": "Lib layer must not import from UI layer (pages, components, hooks). Business logic stays in lib.",
  "severity": "error"
}
```
