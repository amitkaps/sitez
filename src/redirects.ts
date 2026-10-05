/** @prose
 * # Redirects
 *
 * A page that moved lists the URLs it used to have under `redirects`, and Sitez writes a small page
 * at each one that sends the browser on ([docs/idea.md#metadata](docs/idea.md#metadata)). A page's
 * URL is still its file's path (rule 2). A redirect only points old addresses at it, so a site can
 * move its files without breaking links from elsewhere.
 *
 * The page at an old URL is `code/index.html` rendered for the page it reaches (`site.ts`). A
 * redirect is checked as a link is. It can't be a URL a page or another redirect has, and a link
 * to it fails, asking for the page it reaches. So nothing on the site goes through one.
 *
 * An old `/x.html` can't redirect while a page has `/x/`. Hosts serve `x.html` at `/x` too, so the
 * redirect page would stand in front of that page's `/x`. When the page is the one listing it, the
 * redirect isn't needed on Cloudflare, which sends `/x.html` to `/x/` by itself. GitHub Pages
 * doesn't, and there the old `/x.html` is lost ([docs/design.md#redirects](docs/design.md#redirects)).
 */
import { join, relative } from "node:path";
import { outputFile } from "./discover.ts";
import { SiteError } from "./errors.ts";
import type { PageData } from "./metadata.ts";

/** @prose
 * The old URL a path names, as the site would serve it, or `undefined` when no static host could
 * serve a redirect there. A page's URL ends in `/` (`/about` is read as `/about/`, as a link is),
 * and an old page may end in `.html`. Any other extension is a file, which a page can't stand in
 * for.
 */
export function redirectUrl(path: string): string | undefined {
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\s]/.test(path)) return undefined;
  const last = path.slice(path.lastIndexOf("/") + 1);
  if (last === "" || last.endsWith(".html")) return path;
  return last.includes(".") ? undefined : `${path}/`;
}

/** The file a redirect is written to: `old/index.html` for `/old/`, `old.html` for `/old.html`. */
export function redirectFile(url: string): string {
  return url.endsWith(".html") ? join(...url.split("/").filter(Boolean)) : outputFile(url);
}

/** @prose
 * Every redirect the site's pages list, from each old URL to the page's URL. `all` is every page,
 * drafts included, so no redirect can take a draft's URL. `listing` is the pages this run writes,
 * whose redirects it writes. Each failure names the page that lists the redirect.
 */
export function readRedirects(
  root: string,
  all: { file: string; data: PageData }[],
  listing: { file: string; data: PageData }[],
): Map<string, string> {
  const pages = new Map(
    all.map(({ file, data }) => [outputFile(data.url), { file, url: data.url }]),
  );
  const redirects = new Map<string, string>();
  const listedBy = new Map<string, string>();
  for (const { file, data } of listing) {
    const value = data.redirects;
    const paths = value === undefined ? [] : Array.isArray(value) ? value : [value];
    for (const path of paths as string[]) {
      const url = redirectUrl(path);
      const fail = (problem: string) => new SiteError(file, `redirects lists ${path}: ${problem}`);
      if (url === undefined) {
        throw fail(
          "write each old URL as a path on this site, such as /old-name/ or /old-name.html.",
        );
      }
      const page = pages.get(redirectFile(url));
      if (page?.url === data.url) {
        throw fail(
          "that's this page's own URL. List the URLs that used to reach this page, and it gets a redirect from each.",
        );
      }
      if (page) throw fail(`that's the URL of ${relative(root, page.file)}.`);
      const shadowed = url.endsWith(".html")
        ? pages.get(outputFile(`${url.slice(0, -5)}/`))
        : undefined;
      if (shadowed?.url === data.url) {
        throw fail(
          `a host serves ${url.slice(1)} at ${url.slice(0, -5)} too, so the redirect page would stand in front of this page. Remove it.`,
        );
      }
      if (shadowed) {
        throw fail(
          `a host serves ${url.slice(1)} at ${url.slice(0, -5)} too, which reaches ${relative(root, shadowed.file)}.`,
        );
      }
      const other = listedBy.get(redirectFile(url));
      if (other) throw fail(`${relative(root, other)} lists it too. Keep one.`);
      listedBy.set(redirectFile(url), file);
      redirects.set(url, data.url);
    }
  }
  return redirects;
}
