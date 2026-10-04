/** @prose
 * # Redirects
 *
 * A page that moved lists the URLs it used to have under `redirects`, and Sitez writes a small page
 * at each one that sends the browser on ([docs/idea.md#metadata](docs/idea.md#metadata)). A page's
 * URL is still its file's path (rule 2). A redirect only points old addresses at it, so a site can
 * move its files without breaking links from elsewhere.
 *
 * A redirect is checked as a link is. It can't be a URL a page or another redirect has, and a link
 * to it fails, asking for the page it reaches. So nothing on the site goes through one.
 */
import { join, relative } from "node:path";
import { outputFile } from "./discover.ts";
import { SiteError } from "./errors.ts";
import { escape } from "./head.ts";
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
      const other = listedBy.get(redirectFile(url));
      if (other) throw fail(`${relative(root, other)} lists it too. Keep one.`);
      listedBy.set(redirectFile(url), file);
      redirects.set(url, data.url);
    }
  }
  return redirects;
}

/** @prose
 * The page written at an old URL. It refreshes at once to the new one, which search engines read
 * as a permanent redirect, and its canonical link names the new page. It isn't indexed itself, and
 * a link stays for a browser that doesn't refresh. It works on any static host, where a host's
 * redirect file works only on that host.
 */
export function redirectPage(siteUrl: string, to: string): string {
  const href = escape(to);
  return [
    "<!doctype html>",
    '<meta charset="utf-8">',
    `<title>Moved to ${href}</title>`,
    `<link rel="canonical" href="${escape(new URL(to, siteUrl).href)}">`,
    '<meta name="robots" content="noindex">',
    `<meta http-equiv="refresh" content="0; url=${href}">`,
    `<p>This page has moved to <a href="${href}">${href}</a>.</p>`,
    "",
  ].join("\n");
}
