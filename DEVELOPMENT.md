# Development

## Tooling

- **Bun** — package manager and script runner. Use `bun install`, `bun run <script>`
- **tsup** — bundling the `nextlytics` package
- **Vitest** — testing

## Commands

```bash
bun run typecheck    # Type check all packages
bun run build        # Build all packages
bun run lint         # Lint all packages
bun run format       # Format code with Prettier
bun run format:check # Check formatting

bun run website:dev  # Run website in dev mode
```

## Package Scripts

Inside `packages/nextlytics`:

```bash
bun run test         # Run tests
bun run test:watch   # Run tests in watch mode
```
