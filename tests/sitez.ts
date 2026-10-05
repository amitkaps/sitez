/** @prose
 * # Sitez, for the example sites
 *
 * What each example site's `vite.config.js` imports in place of `@amitkaps/sitez/vite`. It is the
 * plugin from `src/`, and it resolves `@amitkaps/sitez`, which a site finds in its own
 * `node_modules`, to the runtime in `src/`. It follows the plugin's own resolver so
 * that an import `liveBoundary` should refuse is still refused first.
 */
import { join } from "node:path";
import type { Plugin } from "vite";
import sitez from "../src/plugin.ts";
import { PACKAGE } from "../src/vite.ts";

export default function sitezFromSource(): Plugin[] {
  return [
    ...sitez(),
    {
      name: "test:sitez-runtime",
      enforce: "pre",
      resolveId: (id) =>
        id === PACKAGE ? join(import.meta.dirname, "../src/runtime/index.ts") : null,
    },
  ];
}
