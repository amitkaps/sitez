/** @prose
 * # Build config
 *
 * The repo's own toolchain, not the one Sitez gives a site: one
 * [`vite-plus`](https://vite-plus.dev) config drives format, lint, test and the package build.
 * `pack` bundles the CLI with tsdown; `prose()` ([`@amitkaps/prose`](https://github.com/amitkaps/prose),
 * dev-only) is mounted at `/__prose/` by `vp dev`.
 */
import { defineConfig } from "vite-plus";
import { prose } from "@amitkaps/prose";

// The example sites are inputs to the tests, formatted the way a site's author would leave them;
// the snapshots are Sitez's output, exactly as written.
const ignored = ["dist/**", "test/sites/**", "test/snapshots/**", "pnpm-lock.yaml"];

export default defineConfig({
  plugins: process.env.VITEST ? [] : [prose()],

  // tsdown — `vp pack`. The CLI is the package: one ESM entry, run by Node, and the runtime
  // files a site's own build loads through Vite, copied as they are.
  pack: {
    entry: ["src/cli.ts"],
    copy: [{ from: "src/runtime/*", to: "dist/runtime" }],
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
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});
