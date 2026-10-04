/** @prose
 * # Build config
 *
 * The repo's own toolchain, not the one Sitez gives a site: one
 * [`vite-plus`](https://vite-plus.dev) config drives format, lint, test and the package build.
 * `pack` bundles the CLI with tsdown. Reading the repo as prose is a separate tool,
 * [`@amitkaps/prose`](https://github.com/amitkaps/prose): run `pnpm prose`.
 */
import { defineConfig } from "vite-plus";

// The example sites are inputs to the tests, formatted the way a site's author would leave them;
// the snapshots are Sitez's output, exactly as written.
const ignored = ["dist/**", "tests/sites/**", "tests/snapshots/**", "pnpm-lock.yaml"];

export default defineConfig({
  // tsdown — `vp pack`. Three ESM entries: the CLI, run by Node, and the two halves of the
  // `sitez` import, with their types. The other files a site's own build loads through Vite are
  // copied as they are.
  pack: {
    entry: {
      cli: "src/cli.ts",
      "runtime/index": "src/runtime/index.ts",
      "runtime/browser": "src/runtime/browser.ts",
    },
    dts: true,
    copy: ["src/runtime/*.{css,json,svelte}", "src/runtime/server.ts", "src/runtime/client.ts"].map(
      (from) => ({ from, to: "dist/runtime" }),
    ),
    format: ["esm"],
    platform: "node",
    clean: true,
    fixedExtension: false,
  },

  // Oxfmt — `vp fmt` / `vp check`.
  // oxfmt's defaults, with Svelte turned on, as for every site.
  fmt: {
    svelte: {},
    ignorePatterns: ignored,
  },

  // Oxlint — `vp lint` / `vp check`.
  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ignored,
  },

  // Vitest — `vp test`.
  test: {
    expect: { requireAssertions: true },
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30_000,
    isolate: false,
  },
});
