/** @prose
 * # The Vite plugin
 *
 * What a site adds to its `vite.config.js`, with no options: `sitez()` from `@amitkaps/sitez/vite`.
 * The plugin is the site's `dev`, `build` and `preview`, under Vite's own commands. `dev.ts` serves
 * pages through Vite's dev server, and `build.ts` renders them and has Vite bundle the CSS and the
 * script. `vp preview` serves what `build` wrote.
 */
import type { Plugin } from "vite-plus";
import { buildPlugin } from "./build.ts";
import { devPlugin } from "./dev.ts";
import { browserBoundary, elementParts } from "./vite.ts";

/** @prose
 * Adds Sitez to a site's Vite config. `mpa` makes `vp preview` serve a folder's `index.html` as
 * a static host does, where `spa` would answer every address with the home page. `dev` has no use
 * for it, since its pages are rendered before Vite's own middleware.
 */
export default function sitez(): Plugin[] {
  return [
    { name: "sitez", config: () => ({ appType: "mpa" }) },
    browserBoundary(),
    elementParts(),
    devPlugin(),
    buildPlugin(),
  ];
}
