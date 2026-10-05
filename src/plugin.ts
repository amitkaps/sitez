/** @prose
 * # The Vite plugin
 *
 * What a site adds to its `vite.config.js`, with no options: `sitez()` from `@amitkaps/sitez/vite`.
 * The plugin is the site's `dev`, `build` and `preview`, under Vite's own commands. `dev.ts` serves
 * pages through Vite's dev server, and `build.ts` renders them and has Vite bundle the CSS and the
 * script. `vite preview` serves what `build` wrote.
 */
import { searchForWorkspaceRoot, type Plugin } from "vite";
import { buildPlugin } from "./build.ts";
import { devPlugin } from "./dev.ts";
import { liveBoundary, runtime } from "./vite.ts";

/** @prose
 * Adds Sitez to a site's Vite config. The reset sits beside this file in the package, outside the
 * site, so the dev server is allowed to serve it. `allow` replaces Vite's own default, the
 * workspace's root, so a site that sets none keeps it. `mpa` makes `vite preview` serve a folder's
 * `index.html` as a static host does, where `spa` would answer every address with the home page.
 * `dev` has no use for either, since its pages are rendered before Vite's own middleware.
 */
export default function sitez(): Plugin[] {
  return [
    {
      name: "sitez",
      config(user) {
        const allowed = user.server?.fs?.allow;
        const workspace = allowed ? [] : [searchForWorkspaceRoot(user.root ?? process.cwd())];
        return { appType: "mpa", server: { fs: { allow: [runtime, ...workspace] } } };
      },
    },
    liveBoundary(),
    devPlugin(),
    buildPlugin(),
  ];
}
