/** @prose
 * # Sitez, for the example sites
 *
 * What each example site's `vite.config.js` imports in place of `@amitkaps/sitez/vite`. It is the
 * plugin from `src/`, and it resolves `@amitkaps/sitez`, which a site finds in its own
 * `node_modules`, to `src/elementz/index.ts`. It follows the plugin's own resolver so
 * that an import `browserBoundary` should refuse is still refused first.
 *
 * The plugin is imported by its full URL, and that is deliberate. Vite loads a config again for
 * each build it makes, and re-evaluates every relative import in it, so a plugin imported as
 * `../src/plugin.ts` would be a new copy of `src/` each time, and a `SiteError` from one copy
 * wouldn't be an `instanceof` another's. A site gets one copy, since its plugin is a package in
 * `node_modules`. A URL isn't a relative import, so here it is one copy too, and
 * `vite.config.ts` lets the tests load `src/` as Node does, so they share it.
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin } from "vite";

const src = (file: string) => pathToFileURL(join(import.meta.dirname, "../src", file)).href;
const { default: sitez } = (await import(src("plugin.ts"))) as typeof import("../src/plugin.ts");
const { PACKAGE } = (await import(src("vite.ts"))) as typeof import("../src/vite.ts");

export default function sitezFromSource(): Plugin[] {
  return [
    ...sitez(),
    {
      name: "test:sitez-runtime",
      enforce: "pre",
      resolveId: (id) =>
        id === PACKAGE ? join(import.meta.dirname, "../src/elementz/index.ts") : null,
    },
  ];
}
