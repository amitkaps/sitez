/** @prose
 * # Build config
 *
 * The same toolchain a site runs Sitez with: one [`vite-plus`](https://viteplus.dev) config
 * drives format, lint, test and the package build. `pack` bundles the plugin with tsdown. Reading the repo as prose is a separate tool,
 * [`@amitkaps/prose`](https://github.com/amitkaps/prose): run `pnpm prose`.
 */
import { defineConfig } from "vite-plus";

// The example sites are inputs to the tests, formatted the way a site's author would leave them;
// the snapshots are Sitez's output, exactly as written.
const ignored = ["dist/**", "tests/sites/**", "tests/snapshots/**", "pnpm-lock.yaml"];

export default defineConfig({
  // tsdown — `vp pack`. Two ESM entries: the plugin a site's `vite.config.js` imports, and the
  // `sitez` import with its types. Markz is a dev dependency, so it's bundled into `dist/`, and
  // publint checks the package as npm will serve it.
  pack: {
    entry: {
      plugin: "src/plugin.ts",
      "elementz/index": "src/elementz/index.ts",
    },
    dts: { generator: "oxc" },
    format: ["esm"],
    platform: "node",
    clean: true,
    fixedExtension: false,
    publint: { strict: true },
  },

  // Oxfmt — `vp fmt` / `vp check`.
  // oxfmt's defaults, as for every site.
  fmt: {
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
    // Node loads `src/` as it is, so the tests share one copy of it with the plugin that the
    // example sites' configs load (`tests/sitez.ts`).
    server: { deps: { external: [/\/src\/(?!.*\.test\.ts)/] } },
  },
});
