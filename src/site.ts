/** @prose
 * # A run over the site
 *
 * What `vp build` and `vp dev` share, so they can't render a page differently. A run reads the site,
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
import { usedElements, type Used } from "./browser.ts";
import { readData } from "./data.ts";
import { discover, readElements, NOT_FOUND, SITE_FILE, type Page } from "./discover.ts";
import { renderElement, renderElements, type Host } from "./elementz/elements.ts";
import { readElement, type ElementFile } from "./elementz/file.ts";
import { SiteError } from "./errors.ts";
import { escape, pageHead, readFrame, withStyles, type Frame } from "./head.ts";
import { linkTarget, renderedLinkProblem, type LinkTargets } from "./links.ts";
import { isDraft, textMetadata, siteMetadata, type Metadata, type PageData } from "./metadata.ts";
import { inFrame, SCOPE, type Props } from "./render.ts";
import { readRedirects } from "./redirects.ts";
import { textHtml } from "./text.ts";
import { asGiven, partId, type SiteServer } from "./vite.ts";
import { markzWarnings, type MarkzWarning } from "./warnings.ts";

export interface Run {
  root: string;
  site: Metadata & { url: string };
  server: SiteServer;
  links: LinkTargets;
  /** Every element in `code/`, read and checked. */
  elements: Map<string, ElementFile>;
  /** `code/index.html`, read and checked. */
  frame: Frame;
  /** The pages this run writes or serves, in discovery order. */
  pages: Page[];
  data: Map<Page, PageData>;
  /** Every page's metadata but the 404's, as each page gets it in `pages`. */
  listed: PageData[];
  /** Markz's, from `site.md` and every page this run renders. */
  warnings: MarkzWarning[];
}

/** @prose
 * One page, rendered: the frame around it, with the elements in it rendered and its head written,
 * and the page's HTML, which goes where the frame has `SLOT`. They stay apart until the stylesheets
 * and scripts are known, since the head is the frame's and the page's HTML mustn't be read as it.
 */
export interface Rendered {
  url: string;
  file: string;
  ms: number;
  data: PageData;
  frame: string;
  body: string;
  /** The elements the page's HTML uses that ship CSS or behavior, sorted by tag. */
  elements: Used[];
}

/** @prose
 * `url` in `site.md` is required, since every page's canonical link and Open Graph URL is a full
 * address, and a relative one would be a guess.
 */
export function readSite(root: string): Metadata & { url: string } {
  const site = siteMetadata(root);
  if (typeof site.url !== "string") {
    throw new SiteError(
      join(root, SITE_FILE),
      "there's no url, which every page's canonical link needs. Add the site's address: url: https://example.com",
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
  const elements = new Map(
    [...readElements(root)].map(([tag, file]) => [tag, readElement(file, SCOPE)] as const),
  );
  const frame = readFrame(root);
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
    redirects: new Map(),
  };
  for (const page of pages) links.pages.set(page.url, { draft: draft(data.get(page)!) });
  const built = pages.filter((page) => !draft(data.get(page)!));
  const listed = built.filter((page) => page.url !== NOT_FOUND).map((page) => data.get(page)!);
  const entry = (page: Page) => ({ file: page.file, data: data.get(page)! });
  links.redirects = readRedirects(root, pages.map(entry), built.map(entry));
  return { root, site, server, links, elements, frame, pages: built, data, listed, warnings };
}

/** @prose
 * One page: its text, then the frame around it, then every link in the result checked. The frame's
 * elements render for each page, since they can read `page`.
 */
export async function renderPage(run: Run, page: Page): Promise<Rendered> {
  const t = performance.now();
  try {
    const body = await textOf(run, page);
    return await framed(run, page.file, page.url, run.data.get(page)!, body, false, t);
  } catch (error) {
    throw notDefined(error, run.root, run.server.real) ?? error;
  }
}

/** @prose
 * The page at an old URL. It is `code/index.html` rendered for the page it reaches, so the frame's
 * elements never see a page with no metadata. Its slot holds a link to the new URL, and its head
 * refreshes there, names it canonical and asks not to be indexed (`pageHead`).
 */
export async function renderRedirect(run: Run, from: string, to: string): Promise<Rendered> {
  const t = performance.now();
  const target = run.pages.find((page) => page.url === to)!;
  const body = `<p>This page has moved to <a href="${escape(to)}">${escape(to)}</a>.</p>`;
  try {
    const page = await framed(run, target.file, to, run.data.get(target)!, body, true, t);
    return { ...page, url: from };
  } catch (error) {
    throw notDefined(error, run.root, run.server.real) ?? error;
  }
}

function host(run: Run, props: Props): Host {
  return {
    elements: run.elements,
    load: (element) => run.server.load(partId(element.file, "template")),
    data: (path) => readData(run.root, path),
    context: { ...props },
  };
}

async function framed(
  run: Run,
  file: string,
  url: string,
  data: PageData,
  text: string,
  redirect: boolean,
  t: number,
): Promise<Rendered> {
  const { root, site, frame } = run;
  const rendered = await renderElements(
    host(run, { page: data, pages: run.listed, site }),
    frame.html,
    frame.file,
    [],
  );
  const head = pageHead(rendered, data, site, redirect);
  // The stylesheets are the build's to check, and are linked by files, not URLs.
  const problem = renderedLinkProblem(
    run.links,
    url,
    inFrame(
      withStyles(head, () => "#"),
      text,
    ),
  );
  if (problem) {
    throw new SiteError(
      file,
      `${problem} The link is in this page, ${relativeTo(root, frame.file)} or an element they render.`,
    );
  }
  return {
    url,
    file,
    data,
    frame: head,
    body: text,
    elements: usedElements(run.elements, inFrame(head, text)),
    ms: performance.now() - t,
  };
}

const relativeTo = (root: string, file: string) => file.slice(root.length + 1);

/** @prose
 * A text page's HTML (`text.ts`). Each element is the one of its name in `code/`, whichever folder
 * its file sits in, and its template gets its attributes as `attrs`, with `data` parsed, and the
 * page's `page`, `pages` and `site`.
 */
async function textOf(run: Run, page: Page): Promise<string> {
  const { root } = run;
  const doc = parse(readFileSync(page.file, "utf8"));
  const site = host(run, { page: run.data.get(page)!, pages: run.listed, site: run.site });
  return textHtml(page.file, doc, {
    element: (name) => run.elements.has(name),
    link: (destination, kind) => linkTarget(run.links, page.file, destination, kind),
    data: (path) => readData(root, path),
    render: (name, attributes, children, data) =>
      renderElement(site, name, attributes, children, data, []),
  });
}

/** @prose
 * A name used without an import fails only as it renders. The file that
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
  const file = asGiven(root, real, frame.split("?")[0]!);
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
