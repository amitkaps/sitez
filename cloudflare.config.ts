/** @prose
 * # How the site is deployed
 *
 * Cloudflare builds this repository's own site from `main`: the repository read with prose. It
 * serves it as a Worker with static assets, which are only the pages `prose build` writes.
 *
 * The Worker's build command is `pnpm run verify`, which ends with `vp build`: Vite hands `.prose`
 * to Cloudflare, as [vite.config.ts](vite.config.ts) says. Its deploy command is `pnpm run ship`,
 * which runs `cf deploy --prebuilt`. This file names the domain, so a deploy can't drop it. The
 * steps are in [development](docs/development.md#the-site).
 */
import { site } from "@amitkaps/craftz/cloudflare";

export default site({
  name: "sitez",
  domains: ["sitez.amitkaps.com"],
  assets: {
    directory: ".prose",
    // Serve the site's own 404.html for any missing address.
    notFoundHandling: "404-page",
    // Serve /src/site.ts from src/site.ts.html, with no redirect.
    htmlHandling: "auto-trailing-slash",
  },
});
