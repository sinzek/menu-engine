# Menu Engine 🚀

A high-performance, modern, and robust TypeScript API for menu engineering. Built to be publishable directly to npm with native ESM and CommonJS support.

---

## Features

- **Dual-Package Support**: ESM (`.js`) and CommonJS (`.cjs`) builds out of the box using `tsup`.
- **TypeScript First**: Strong typings (`.d.ts` and `.d.cts`) generated automatically.
- **Fast Testing**: Pre-configured with [Vitest](https://vitest.dev/) for instantaneous test execution.
- **Optimized for Bundlers**: Modern exports map configured for seamless imports in Node.js, Vite, Webpack, Rollup, and Bun.

---

## Project Structure

```text
├── dist/                  # Compiled assets (generated during build)
│   ├── index.js          # ESM bundle
│   ├── index.cjs         # CommonJS bundle
│   ├── index.d.ts        # ESM declarations
│   └── index.d.cts       # CommonJS declarations
├── src/
│   ├── index.ts          # Core API Entry point
│   └── __tests__/        # Vitest suite
│       └── index.test.ts # API unit tests
├── .gitignore            # Git exclusion list
├── package.json          # Main package manifest
├── tsconfig.json         # TypeScript compiler configurations
└── tsup.config.ts        # Fast bundling configuration
```

---

## Development Workflow

### 1. Installation
Install project dependencies using `pnpm`:
```bash
pnpm install
```

### 2. Run Tests
Execute the unit test suite:
```bash
pnpm test
```

For continuous testing (watch mode) during development:
```bash
pnpm test:watch
```

### 3. Build for Production
Generate the ESM, CommonJS bundles, and TypeScript declaration files inside `/dist`:
```bash
pnpm run build
```

### 4. Development Build (Watch Mode)
Re-build automatically as you modify source files:
```bash
pnpm run dev
```

---

## How to Publish to npm

This package is preconfigured with standard publishing safety practices:
- **Only** files in the `/dist` directory are packaged and uploaded (`"files": ["dist"]` in `package.json`).
- It runs the build script automatically before publishing (`prepublishOnly: "pnpm run build"`).

To publish:

1. Update the version inside `package.json` or use `pnpm version`:
   ```bash
   pnpm version <patch|minor|major>
   ```

2. Log into your npm account if not already logged in:
   ```bash
   pnpm login
   ```

3. Publish to npm:
   ```bash
   pnpm publish
   ```
   *(Add `--access public` if publishing a scoped package for the first time)*

---

## License

ISC License. See `package.json` for details.
