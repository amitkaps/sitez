/** @prose
 * # The dev server
 *
 * `vp dev` on a copy of the blog, with Sitez in its config: how it serves pages, and what the
 * browser is told when a file changes.
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createServer, type ViteDevServer } from "vite-plus";

// A copy of the blog, since the tests change its files as an author would. Its config reaches the
// plugin in `src/`, from where the copy sits.
const site = join(mkdtempSync(join(tmpdir(), "sitez-dev-")), "blog");
cpSync(join(import.meta.dirname, "../tests/sites/blog"), site, { recursive: true });
writeFileSync(
  join(site, "vite.config.js"),
  `import sitez from ${JSON.stringify(join(import.meta.dirname, "../tests/sitez.ts"))};\n\nexport default { plugins: [sitez()] };\n`,
);

let vite: ViteDevServer;
let url: string;
beforeAll(async () => {
  vite = await createServer({
    root: site,
    configLoader: "native",
    logLevel: "silent",
    server: { port: 0, host: "localhost" },
  });
  await vite.listen();
  url = vite.resolvedUrls!.local[0]!;
});
afterAll(() => vite.close());

const get = (path: string) => fetch(new URL(path, url), { redirect: "manual" });

describe("pages", () => {
  test("a page is the frame around it, with its stylesheet linked from code/ and its own script", async () => {
    const response = await get("/blog/");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<tag-filter>");
    expect(html).toContain('<link rel="stylesheet" href="/code/style.css" />');
    expect(html).toContain('<script type="module" src="/@vite/client"></script>');
    expect(html).toContain('<script type="module" src="/@sitez/page.js?url=%2Fblog%2F"></script>');
    expect(html).toContain("<title>Field Notes</title>");
    expect(html).toContain('<link rel="canonical" href="https://notes.example.com/blog/">');
  });

  test("the stylesheet is served as CSS, where Vite can replace it", async () => {
    const response = await fetch(new URL("/code/style.css", url), {
      headers: { accept: "text/css" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(await response.text()).toContain("Blog Serif");
  });

  test("an element's CSS is linked from its file, and served as CSS in @layer elements", async () => {
    const html = await (await get("/blog/hello/")).text();
    const href = "/code/@call-out.html?sitez=style&lang.css";
    expect(html).toContain(`<link rel="stylesheet" href="${href}" />`);
    const response = await fetch(new URL(href, url), { headers: { accept: "text/css" } });
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(await response.text()).toMatch(/@layer elements\s*\{\s*call-out/);
  });

  test("the page's own script defines the elements with behavior it uses, and a page with none defines none", async () => {
    const page = await (await get("/@sitez/page.js?url=%2Fblog%2F")).text();
    expect(page).toMatch(/import setup0 from "\/code\/blog\/@tag-filter\.html\?.*sitez=setup/);
    expect(page).toContain('define("tag-filter", setup0)');
    expect(await (await get("/@sitez/page.js?url=%2Fabout%2F")).text()).not.toContain("define(");
    // What the browser loads, by the URL the page's script imports it from.
    const imported = /import setup0 from "([^"]+)"/.exec(page)![1]!;
    const setup = await (await get(imported)).text();
    expect(setup).toContain('addEventListener("click"');
  });

  test("a draft is served", async () => {
    expect((await get("/blog/draft/")).status).toBe(200);
  });

  test("/blog redirects to /blog/, as a host would", async () => {
    const response = await get("/blog");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/blog/");
  });

  test("a page's old URL redirects to it, a draft's too", async () => {
    for (const [path, location] of [
      ["/hello/", "/blog/hello/"],
      ["/hello", "/blog/hello/"],
      ["/hello.html", "/blog/hello/"],
      ["/not-yet/", "/blog/draft/"],
    ]) {
      const response = await get(path!);
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(location);
    }
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

  test("public/ is served, and Sitez writes no sitemap or feed", async () => {
    expect((await get("/favicon.svg")).status).toBe(200);
    for (const path of ["/feed.xml", "/sitemap.xml"]) expect((await get(path)).status).toBe(404);
  });
});

describe("changes", () => {
  /** @prose
   * What Vite tells the browser after a file changes, read from its hot-update socket as the
   * page's `@vite/client` would read it.
   */
  async function afterChange(change: () => void): Promise<{ type: string; kinds: string[] }> {
    const socket = new WebSocket(url.replace(/^http/, "ws"), "vite-hmr");
    const messages: { type: string; updates?: { type: string }[] }[] = [];
    await new Promise<void>((resolve) => {
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === "connected") resolve();
        else messages.push(message);
      });
    });
    // The browser has loaded the page, so its modules are in Vite's graph.
    await (await get("/@sitez/page.js?url=%2Fblog%2F")).text();
    await fetch(new URL("/code/style.css", url), { headers: { accept: "text/css" } });
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

  test("CSS is replaced in place, as it is linked", async () => {
    const message = await afterChange(edit("code/style.css", "40rem", "42rem"));
    expect(message.type).toBe("update");
  });

  test("code reloads the page, which shows the change", async () => {
    const message = await afterChange(edit("code/blog/@tag-filter.html", ">All<", ">Every<"));
    expect(message.type).toBe("full-reload");
    expect(await (await get("/blog/")).text()).toContain(">Every</button>");
  });

  test("the frame reloads the page, which shows the change", async () => {
    const message = await afterChange(
      edit("code/index.html", '<a href="/">Field Notes</a>', '<a href="/">Notes, Field</a>'),
    );
    expect(message.type).toBe("full-reload");
    expect(await (await get("/about/")).text()).toContain(">Notes, Field</a>");
  });

  test("a frame that breaks the rules shows as build's message, and fixing it reloads", async () => {
    edit("code/index.html", "<title>Field Notes</title>", "")();
    const broken = await get("/about/");
    expect(broken.status).toBe(500);
    expect(await broken.text()).toContain("code/index.html: there's no &lt;title&gt;.");
    const message = await afterChange(
      edit("code/index.html", "<head>", "<head><title>Field Notes</title>"),
    );
    expect(message.type).toBe("full-reload");
    expect((await get("/about/")).status).toBe(200);
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
    edit("code/style.css", "./fonts/Serif.woff2", "./fonts/Serify.woff2")();
    const broken = await get("/about/");
    expect(broken.status).toBe(500);
    expect(await broken.text()).toContain(
      "code/style.css: url(./fonts/Serify.woff2) isn't there. Fix the path: relative to this file, or /… for a file in public/.",
    );
    const message = await afterChange(
      edit("code/style.css", "./fonts/Serify.woff2", "./fonts/Serif.woff2"),
    );
    expect(message.type).toBe("full-reload");
    expect((await get("/about/")).status).toBe(200);
  });

  test("a mistake shows as build's message, in the page", async () => {
    await afterChange(edit("text/about.md", "the blog", "the [gone](gone.md) blog"));
    const response = await get("/about/");
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain("text/about.md: line 9: gone.md isn't there: no file at text/gone.md.");
    expect(html).toContain("/@vite/client");
  });
});
