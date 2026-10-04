/** @prose
 * # The dev server
 *
 * `sitez dev` on a copy of the blog: how it serves pages, and what the browser is told when a
 * file changes.
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { dev, type Dev } from "./dev.ts";

// A copy of the blog, since the tests change its files as an author would.
const site = join(mkdtempSync(join(tmpdir(), "sitez-dev-")), "blog");
cpSync(join(import.meta.dirname, "../tests/sites/blog"), site, { recursive: true });

let server: Dev;
beforeAll(async () => {
  server = await dev(site, { port: 0, cwd: site });
});
afterAll(() => server.close());

const get = (path: string) => fetch(new URL(path, server.url), { redirect: "manual" });

describe("pages", () => {
  test("a page is rendered with Vite and its own scripts, hidden until styled", async () => {
    const response = await get("/blog/");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<tag-filter>");
    expect(html).toContain('<style id="sitez-hidden">@view-transition{navigation:auto}html{');
    expect(html).toContain('<script type="module" src="/@vite/client"></script>');
    expect(html).toContain(
      '<script type="module" blocking="render" src="/@sitez/styles.js?url=%2Fblog%2F"></script>',
    );
    expect(html).toContain('<script type="module" src="/@sitez/page.js?url=%2Fblog%2F"></script>');
  });

  test("the page's styles script loads the stylesheet and shows the page", async () => {
    const styles = await (await get("/@sitez/styles.js?url=%2Fblog%2F")).text();
    expect(styles).toContain("/code/+style.css");
    expect(styles).toContain("document.getElementById('sitez-hidden')?.remove();");
  });

  test("a draft is served", async () => {
    expect((await get("/blog/draft/")).status).toBe(200);
  });

  test("/blog redirects to /blog/, as a host would", async () => {
    const response = await get("/blog");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/blog/");
  });

  test("a URL that isn't valid percent-encoding is answered, not fatal", async () => {
    expect((await get("/%E0")).status).toBe(404);
    expect((await get("/blog/")).status).toBe(200);
  });

  test("a URL with no page gets the 404 page", async () => {
    const response = await get("/nothing/");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("<title>");
  });

  test("the feed, the sitemap and public/ are served", async () => {
    for (const path of ["/feed.xml", "/sitemap.xml", "/favicon.svg"]) {
      expect((await get(path)).status).toBe(200);
    }
  });
});

describe("changes", () => {
  /** @prose
   * What Vite tells the browser after a file changes, read from its hot-update socket as the
   * page's `@vite/client` would read it.
   */
  async function afterChange(change: () => void): Promise<{ type: string; kinds: string[] }> {
    const socket = new WebSocket(server.url.replace(/^http/, "ws"), "vite-hmr");
    const messages: { type: string; updates?: { type: string }[] }[] = [];
    await new Promise<void>((resolve) => {
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === "connected") resolve();
        else messages.push(message);
      });
    });
    // The browser has loaded the page, so its modules are in Vite's graph.
    await (await get("/@sitez/styles.js?url=%2Fblog%2F")).text();
    await (await get("/@sitez/page.js?url=%2Fblog%2F")).text();
    await (await get("/code/+style.css")).text();
    // Only what this change causes: a reload from an earlier change may still be arriving.
    await new Promise((resolve) => setTimeout(resolve, 100));
    messages.length = 0;
    change();
    for (let i = 0; i < 100 && messages.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    socket.close();
    const [first] = messages;
    return { type: first?.type ?? "none", kinds: first?.updates?.map((u) => u.type) ?? [] };
  }

  const edit = (file: string, from: string, to: string) => () => {
    const path = join(site, file);
    writeFileSync(path, readFileSync(path, "utf8").replace(from, to));
  };

  test("CSS is replaced in place", async () => {
    const message = await afterChange(edit("code/+style.css", "40rem", "42rem"));
    expect(message.type).toBe("update");
  });

  test("code reloads the page, which shows the change", async () => {
    const message = await afterChange(edit("code/blog/@tag-filter.js", ">All<", ">Every<"));
    expect(message.type).toBe("full-reload");
    expect(await (await get("/blog/")).text()).toContain(">Every</button>");
  });

  test("text reloads the page, which shows the change", async () => {
    const message = await afterChange(edit("text/about.md", "# About", "# About us"));
    expect(message.type).toBe("full-reload");
    expect(await (await get("/about/")).text()).toContain(">About us</h1>");
  });

  test("a new file is a page at once", async () => {
    await afterChange(() => writeFileSync(join(site, "text/new.md"), "# New\n\nJust added.\n"));
    expect((await get("/new/")).status).toBe(200);
  });

  test("a folder with a non-Latin name redirects with its URL encoded", async () => {
    await afterChange(() => writeFileSync(join(site, "text/博客.md"), "# 博客\n\nIn Chinese.\n"));
    const response = await get("/博客");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/%E5%8D%9A%E5%AE%A2/");
  });

  test("a url() in the CSS that isn't there shows, and fixing it reloads", async () => {
    edit("code/+style.css", "./fonts/Serif.woff2", "./fonts/Serify.woff2")();
    const broken = await get("/about/");
    expect(broken.status).toBe(500);
    expect(await broken.text()).toContain(
      "code/+style.css: url(./fonts/Serify.woff2) isn't there. Fix the path: relative to this file, or /… for a file in public/.",
    );
    const message = await afterChange(
      edit("code/+style.css", "./fonts/Serify.woff2", "./fonts/Serif.woff2"),
    );
    expect(message.type).toBe("full-reload");
    expect((await get("/about/")).status).toBe(200);
  });

  test("a mistake shows as build's message, in the page", async () => {
    await afterChange(edit("text/about.md", "the blog", "the [gone](gone.md) blog"));
    const response = await get("/about/");
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain("text/about.md: line 4: gone.md isn't there: no file at text/gone.md.");
    expect(html).toContain("/@vite/client");
  });
});
