/** @prose
 * # Finding the site
 *
 * The folder holding `site.md` is the site, from wherever `sitez` runs inside it, the way git
 * finds a repo. So `site.md` is the one file every site has, and a site needs no `text/` at all.
 * The nearest `site.md` wins, which lets one repo hold several sites. The nearest `package.json`
 * at or above it names the Sitez that builds it.
 */
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { SiteError } from "./errors.ts";

export const SITE_FILE = "site.md";

/** @prose
 * Walks up from `from` to the first folder with a `site.md`. `text/site.md` is reserved. Found
 * from inside `text/`, with a `site.md` one level up, it would otherwise make `text/` a site of
 * its own. Found from the root, page discovery rejects it with the same message.
 */
export function findRoot(from: string): string {
  const start = resolve(from);
  for (let dir = start; ; dir = dirname(dir)) {
    if (isFile(join(dir, SITE_FILE))) {
      if (basename(dir) === "text" && isFile(join(dirname(dir), SITE_FILE))) {
        throw reserved(join(dir, SITE_FILE));
      }
      return dir;
    }
    if (dirname(dir) === dir) {
      throw new SiteError(
        start,
        `no ${SITE_FILE} here or in any folder above. Sitez needs one at the site's root, holding a metadata block:\n\n---\nname: My site\nurl: https://example.com\n---`,
      );
    }
  }
}

/** @prose
 * Fails unless the site's `package.json` names `sitez`, so the repo records which Sitez builds it
 * ([docs/design.md#install](docs/design.md#install)). It never compares versions, since keeping
 * `node_modules` in step is the package manager's job. Either kind of dependency counts.
 *
 * The site's `package.json` is the nearest one at or above `site.md`, as Node finds packages. So a
 * site in a folder of a larger repo, or several sites in one, can share the repo's.
 */
export function namesSitez(root: string): void {
  const file = nearestPackage(root);
  const line = `"sitez": "${pkg.version}"`;
  const add = `Then run npm install, so this site always builds with the same Sitez.`;
  if (file === undefined) {
    throw new SiteError(
      root,
      `no package.json beside ${SITE_FILE} or in any folder above. Add one naming the Sitez that builds this site:\n\n{ "devDependencies": { ${line} } }\n\n${add}`,
    );
  }
  let manifest: { dependencies?: object; devDependencies?: object };
  try {
    manifest = JSON.parse(readFileSync(file, "utf8")) as typeof manifest;
  } catch (error) {
    throw new SiteError(file, `isn't valid JSON: ${(error as Error).message}`);
  }
  if (
    !Object.hasOwn(manifest.devDependencies ?? {}, "sitez") &&
    !Object.hasOwn(manifest.dependencies ?? {}, "sitez")
  ) {
    throw new SiteError(
      file,
      `doesn't name sitez. Add this line to its "devDependencies":\n\n${line}\n\n${add}`,
    );
  }
}

function nearestPackage(root: string): string | undefined {
  for (let dir = root; ; dir = dirname(dir)) {
    if (isFile(join(dir, "package.json"))) return join(dir, "package.json");
    if (dirname(dir) === dir) return undefined;
  }
}

/** `text/site.md`, found here from inside `text/` or by page discovery from the root. */
export function reserved(file: string): SiteError {
  return new SiteError(
    file,
    `${SITE_FILE} is reserved for the site's metadata, next to text/, so it can't be a page. Rename it, or move its metadata into ../${SITE_FILE}.`,
  );
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}
