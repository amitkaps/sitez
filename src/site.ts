/** @prose
 * # A run over the site
 *
 * What `build` and `dev` share, so they can't render a page differently. A run reads the site,
 * then renders one page into the parts of its document. Reading the site means its metadata, its
 * pages and every page's metadata, which each page gets as `pages` and every link is checked
 * against.
 *
 * `build` reads the site once and renders every page. `dev` reads it again for every request,
 * since any file may have changed, and renders the one asked for. In `dev`, drafts are pages like
 * any other.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@amitkaps/markz";
import { readData } from "./data.ts";
import { checkCode, discover, nearest, NOT_FOUND, type Page } from "./discover.ts";
import { SiteError } from "./errors.ts";
import { headTags } from "./head.ts";
import { raw } from "./runtime/html.ts";
import { linkTarget, renderedLinkProblem, type LinkTargets } from "./links.ts";
import { isDraft, textMetadata, siteMetadata, type Metadata, type PageData } from "./metadata.ts";
import { document, renderHead, renderLayout, renderModule, type Props } from "./render.ts";
import { SITE_FILE } from "./root.ts";
import { textHtml } from "./text.ts";
import { asGiven, type SiteServer } from "./vite.ts";
import { markzWarnings, type MarkzWarning } from "./warnings.ts";

export interface Run {
  root: string;
  site: Metadata & { url: string };
  server: SiteServer;
  links: LinkTargets;
  /** The pages this run writes or serves, in discovery order. */
  pages: Page[];
  data: Map<Page, PageData>;
  /** Every page's metadata but the 404's, as each page gets it in `pages`. */
  listed: PageData[];
  hasFeed: boolean;
  /** Markz's, from `site.md` and every page this run renders. */
  warnings: MarkzWarning[];
}

/** One page, rendered: its document's parts, before the stylesheet and scripts are known. */
export interface Rendered {
  url: string;
  file: string;
  ms: number;
  data: PageData;
  parts: { tags: string; head: string; body: string };
  /** The live elements the page's HTML uses, by tag, sorted. None until step 15. */
  live: string[];
}

/** @prose
 * `url` in `site.md` is required: the sitemap, the feed and every canonical link are full
 * addresses, and a relative one would be a guess.
 */
export function readSite(root: string): Metadata & { url: string } {
  const site = siteMetadata(root);
  if (typeof site.url !== "string") {
    throw new SiteError(
      join(root, SITE_FILE),
      "there's no url, which the sitemap, the feed and every page's canonical link need. Add the site's address: url: https://example.com",
    );
  }
  return site as Metadata & { url: string };
}

/** @prose
 * Every page's metadata, read before anything renders, so the link targets are built whole.
 * `build` leaves drafts out, and so do `pages` and what links can reach, so no page lists or links
 * to what isn't built.
 */
export async function readRun(server: SiteServer, { dev = false } = {}): Promise<Run> {
  const { root } = server;
  const site = readSite(root);
  const siteFile = join(root, SITE_FILE);
  checkCode(root);
  const pages = discover(root);
  const draft = (data: PageData) => !dev && isDraft(data);

  const warnings = markzWarnings(siteFile, parse(readFileSync(siteFile, "utf8")));
  const data = new Map<Page, PageData>();
  for (const page of pages) {
    const doc = parse(readFileSync(page.file, "utf8"));
    const pageData = textMetadata(page.file, page.url, doc);
    data.set(page, pageData);
    if (!draft(pageData)) warnings.push(...markzWarnings(page.file, doc));
  }

  const links: LinkTargets = {
    root,
    repo: typeof site.repo === "string" ? site.repo : undefined,
    pages: new Map(),
    generated: new Set(["/sitemap.xml"]),
  };
  for (const page of pages) links.pages.set(page.url, { draft: draft(data.get(page)!) });
  const built = pages.filter((page) => !draft(data.get(page)!));
  const listed = built.filter((page) => page.url !== NOT_FOUND).map((page) => data.get(page)!);
  const hasFeed = built.some((page) => page.url !== NOT_FOUND && data.get(page)!.date);
  if (hasFeed) links.generated.add("/feed.xml");
  return { root, site, server, links, pages: built, data, listed, hasFeed, warnings };
}

/** @prose
 * One page: its text, then its layout around it, then every link in the result checked. The
 * layout's `head` export adds to the head.
 */
export async function renderPage(run: Run, page: Page): Promise<Rendered> {
  try {
    return await renderOne(run, page);
  } catch (error) {
    throw notDefined(error, run.root, run.server.real) ?? error;
  }
}

async function renderOne(run: Run, page: Page): Promise<Rendered> {
  const { root, site, server, listed } = run;
  const t = performance.now();
  const pageData = run.data.get(page)!;
  const props: Props = { page: pageData, pages: listed, site };
  let body = await renderText(run, page, props);
  let head = "";
  const layoutFile = nearest(root, page.url, "+layout");
  if (layoutFile) {
    const layout = await server.load(layoutFile);
    body = await renderLayout(layoutFile, layout, props, body);
    head = await renderHead(layoutFile, layout, props);
  }
  const tags = headTags(pageData, site, run.hasFeed);
  const problem = renderedLinkProblem(run.links, page.url, document(site, tags, head, body));
  if (problem) {
    throw new SiteError(
      page.file,
      `${problem} The link is in this page, its layout or a component they render.`,
    );
  }
  return {
    url: page.url,
    file: page.file,
    data: pageData,
    parts: { tags, head, body },
    live: [],
    ms: performance.now() - t,
  };
}

/** @prose
 * A text page's HTML (`text.ts`). Each component is found up the tree from the page's URL, as its
 * layout is, and gets the element's attributes, its content as `children`, its `data`, and the
 * page's props.
 */
async function renderText(run: Run, page: Page, props: Props): Promise<string> {
  const { root, server } = run;
  const doc = parse(readFileSync(page.file, "utf8"));
  return textHtml(page.file, doc, {
    component: (name) => nearest(root, page.url, `@${name}`),
    link: (destination, kind) => linkTarget(run.links, page.file, destination, kind),
    data: (path) => readData(root, path),
    render: async (file, attributes, children, data) =>
      renderModule(
        file,
        await server.load(file),
        {
          ...attributes,
          ...(data && { data: data.value }),
          children: children === undefined ? undefined : raw(children),
          ...props,
        },
        "component",
      ),
  });
}

/** @prose
 * A name used without an import, such as a component, fails only as it renders. The file that
 * rendered may not be the one that used it, so the error's stack names the file. Its line numbers
 * are Vite's, after the transform, so the line is found in the source.
 */
function notDefined(error: unknown, root: string, real: string): SiteError | undefined {
  const cause = error instanceof SiteError ? error.cause : error;
  if (!(cause instanceof ReferenceError)) return undefined;
  const name = /^(\S+) is not defined$/.exec(cause.message)?.[1];
  const frame = new RegExp(`\\(?(${escapeRegExp(real)}/[^():]+):\\d+:\\d+`).exec(
    cause.stack ?? "",
  )?.[1];
  if (!name || !frame) return undefined;
  const file = asGiven(root, real, frame);
  const line =
    readFileSync(file, "utf8")
      .split("\n")
      .findIndex((text) => text.includes(name)) + 1;
  return new SiteError(
    file,
    `${line > 0 ? `line ${line}: ` : ""}${name} is used here, but isn't defined. Import it at the top of this file.`,
    { cause },
  );
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** @prose
 * # Naming the file behind a broken link
 *
 * A broken link in the rendered HTML is named against the page (`text/index.md: href="/about"`)
 * even when the layout wrote it, since the check reads the finished document. Look for the
 * `href`/`src` in the layout's source and name that file when it's found there, falling back to "this page, its layout or a component".
 */
