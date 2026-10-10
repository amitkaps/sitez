/** @prose
 * # Building an example site
 *
 * What `vite build` does, from a test: the site's own config file, `dist/` somewhere else, and
 * Vite's logger kept in memory. A site that fails rejects with the `SiteError` the build threw.
 * What the build reports comes back as lines, with Markz's warnings apart from the rest.
 */
import { createBuilder } from "vite-plus";

export async function buildSite(
  root: string,
  outDir: string,
): Promise<{ warnings: string[]; info: string[] }> {
  const warnings: string[] = [];
  const info: string[] = [];
  const builder = await createBuilder(
    {
      root,
      // Native, so the config's imports run as Node runs them, not as a copy bundled into it.
      configLoader: "native",
      build: { outDir },
      customLogger: {
        hasWarned: false,
        info: (message) => void info.push(message),
        warn: (message) => void warnings.push(message),
        warnOnce: (message) => void warnings.push(message),
        error() {},
        clearScreen() {},
        hasErrorLogged: () => false,
      },
    },
    null,
  );
  await builder.buildApp();
  return { warnings, info };
}
