/** @prose
 * # The spike's build
 *
 * Just enough of Sitez 0.2's build to put `/teaching/` side by side with the SvelteKit page:
 * Markz's HTML with each element that has a component replaced by its output, the layout around
 * it, the islands found by scanning the finished HTML, and their bundle. Throwaway: the real one
 * reuses discover, metadata, links and head from `src/`.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { html as markz, parse } from "@amitkaps/markz";
import { build, createServer } from "vite";
import { raw } from "./runtime/html.js";
import { render } from "./runtime/render.js";

const here = import.meta.dirname;
const site = join(here, "site");
const dist = join(here, "dist");
const code = join(site, "code");
const runtime = (file) => resolve(here, "runtime", file);

rmSync(dist, { recursive: true, force: true });
cpSync(join(site, "public"), dist, { recursive: true });
cpSync(join(code, "style.css"), join(dist, "style.css"));

const server = await createServer({
  configFile: false,
  root: site,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { alias: { sitez: runtime("index.js") } },
});
const load = async (file) => (await server.ssrLoadModule(file)).default;

const started = performance.now();
const source = readFileSync(join(site, "text/teaching.md"), "utf8");
const doc = parse(source);
const page = { url: "/teaching/", ...metadata(doc) };
const props = { page, pages: [page], site: { name: "Amit Kapoor" } };

let body = markz(doc);
body = await components(body);
const layout = await load(join(code, "Layout.js"));
body = await render(layout({ ...props, children: raw(body) }), "code/Layout.js");

const islands = readdirSync(code)
  .filter((f) => f.endsWith(".island.js"))
  .map((f) => f.slice(0, -".island.js".length))
  .filter((name) => new RegExp(`<${name}[\\s>]`).test(body));
const script = islands.length ? await bundle(islands) : "";
const renderTime = performance.now() - started;
await server.close();

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title} | Amit Kapoor</title>
<meta name="description" content="${page.summary}">
<link rel="preload" href="/static/fonts/LiterataEN.woff2" as="font" type="font/woff2" crossorigin="anonymous">
<link rel="preload" href="/static/fonts/LiterataENi.woff2" as="font" type="font/woff2" crossorigin="anonymous">
<link rel="stylesheet" href="/style.css">
${script ? `<script type="module" src="/${script}"></script>` : ""}
</head>
<body>
${body}
</body>
</html>
`;
mkdirSync(join(dist, "teaching"), { recursive: true });
writeFileSync(join(dist, "teaching/index.html"), out);

const gz = (s) => `${(gzipSync(s).length / 1024).toFixed(1)} KB`;
console.log(
  `/teaching/  html ${gz(out)}  js ${script ? gz(readFileSync(join(dist, script))) : "—"}  ${renderTime.toFixed(0)} ms`,
);
console.log(`islands: ${islands.join(", ") || "none"}`);

/** Metadata as the page sees it; Markz's block holds strings here. */
function metadata(doc) {
  const block = doc.metadata ?? {};
  return Object.fromEntries(Object.entries(block).map(([k, v]) => [k, v?.value ?? v]));
}

/** Each element with a component in code/ becomes its output, innermost first, so a component's
 *  children arrive rendered. Attributes are string props, as Markz writes them. */
async function components(html) {
  const names = [...new Set([...html.matchAll(/<([a-z]+-[a-z-]+)[\s>]/g)].map((m) => m[1]))].filter(
    (n) => existsSync(join(code, `${pascal(n)}.js`)),
  );
  for (const name of names) {
    const component = await load(join(code, `${pascal(name)}.js`));
    const pattern = new RegExp(
      `<${name}((?:\\s[^>]*)?)>((?:(?!<${name}[\\s>])[\\s\\S])*?)</${name}>`,
      "g",
    );
    const matches = [...html.matchAll(pattern)];
    const outputs = await Promise.all(
      matches.map((m) =>
        render(
          component({ ...props, ...attributes(m[1]), children: raw(m[2]) }),
          `code/${pascal(name)}.js`,
        ),
      ),
    );
    let i = 0;
    html = html.replace(pattern, () => outputs[i++]);
  }
  return html;
}

function attributes(s) {
  return Object.fromEntries([...s.matchAll(/([^\s=]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

function pascal(name) {
  return name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
}

/** One entry per page importing the islands it uses, minified, as Sitez bundles today. */
async function bundle(names) {
  const entry = join(here, ".entry.js");
  writeFileSync(
    entry,
    names.map((n) => `import ${JSON.stringify(join(code, `${n}.island.js`))};`).join("\n"),
  );
  const result = await build({
    configFile: false,
    logLevel: "error",
    resolve: { alias: { sitez: runtime("browser.js") } },
    build: {
      outDir: dist,
      emptyOutDir: false,
      rolldownOptions: {
        input: { teaching: entry },
        output: { entryFileNames: "assets/[name].[hash].js" },
      },
    },
  });
  rmSync(entry);
  return result.output.find((o) => o.type === "chunk" && o.isEntry).fileName;
}
