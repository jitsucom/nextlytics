# Third-party licenses

This project is distributed under the MIT License (see `LICENSE`). MIT requires that the upstream LICENSE text be preserved in each third-party dependency's installed artifact — Bun's package cache does this by default.


This file summarizes the third-party open-source components included in or linked from `nextlytics` (generated from a CycloneDX SBOM of the dependency tree). The full per-package bill of materials is not committed to this repo to keep diffs reviewable; regenerate it with the script below.


## Summary by license category

| Category | Count |
|---|---:|
| Permissive | 783 |
| Permissive (with attribution) | 78 |
| Weak copyleft | 12 |
| **Total third-party components** | **873** |

## What each category means

**Permissive** — Licenses like MIT, BSD, ISC, 0BSD, Unlicense, CC0, Boost, etc. Allow use, modification, and redistribution with minimal restrictions. No source-disclosure or attribution-in-derivative-works requirement beyond preserving the upstream LICENSE text in the package itself.

**Permissive (with attribution)** — Licenses like Apache-2.0, Artistic, CC-BY. Allow use, modification, and redistribution like other permissive licenses, but additionally require preserving any upstream NOTICE file and crediting the original authors. Honored by keeping the LICENSE/NOTICE text in the installed package.

**Weak copyleft** — Licenses like MPL-2.0, LGPL, EPL, CDDL. File-level or library-level copyleft: modifications to the licensed files themselves must be released under the same license, but using the library as a dependency does not force the surrounding project to be open source. Safe for unmodified library use.


## Weak-copyleft dependencies (explicit list)

These are the entries a license-compliance reviewer needs to confirm. All are safe as unmodified library deps; none would force this project to be relicensed.


| Package | Version | Ecosystem | License(s) |
|---|---|---|---|
| `@edge-runtime/format` | 2.2.1 | npm | MPL-2.0 |
| `@edge-runtime/node-utils` | 2.3.0 | npm | MPL-2.0 |
| `@edge-runtime/ponyfill` | 2.4.2 | npm | MPL-2.0 |
| `@edge-runtime/primitives` | 4.1.0 | npm | MPL-2.0 |
| `@edge-runtime/vm` | 3.2.0 | npm | MPL-2.0 |
| `@img/sharp-libvips-darwin-arm64` | 1.2.4 | npm | LGPL-3.0-or-later |
| `@vercel/og` | 0.7.2 | npm | MPL-2.0 |
| `edge-runtime` | 2.5.9 | npm | MPL-2.0 |
| `lightningcss` | 1.30.2 | npm | MPL-2.0 |
| `lightningcss-darwin-arm64` | 1.30.2 | npm | MPL-2.0 |
| `next-mdx-remote` | 6.0.0 | npm | MPL-2.0 |
| `pip-requirements-js` | 1.0.2 | npm | MPL-2.0 |

## Permissive dependencies

There are 861 permissive third-party components. They are not enumerated here to keep this file readable. Each is honored by preserving the upstream LICENSE/NOTICE text in the installed package.

Full attribution is available by:

- Running `syft <repo>/. -o cyclonedx-json` to regenerate the SBOM, or
- Inspecting `node_modules/**/LICENSE` (npm/bun) or `$GOPATH/pkg/mod/.../LICENSE` (Go) in an installed checkout.


## Regenerating this file

This file is auto-generated. To regenerate from the current dep tree:

```bash
# 1. Install dependencies so package metadata is available.
bun install --frozen-lockfile --linker=hoisted

# 2. Generate a CycloneDX SBOM with license enrichment.
SYFT_ENRICH=all \
  SYFT_GOLANG_SEARCH_REMOTE_LICENSES=true \
  SYFT_JAVASCRIPT_SEARCH_REMOTE_LICENSES=true \
  syft . -o cyclonedx-json=sbom.cdx.json
```

The SBOM is the canonical source of truth; this file is a human-readable summary derived from it.
