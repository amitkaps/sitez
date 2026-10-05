/** @prose
 * # The frame and the head
 *
 * What fails `code/index.html`, each with the line to add or remove, and what Sitez writes in a
 * page's head: the page's title and description in place of the frame's, and the tags that follow.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { SiteError } from "./errors.ts";
import { addToHead, pageHead, readFrame, SLOT, withStyles } from "./head.ts";

const frame = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My Site</title>
    <meta name="description" content="The site's own." />
    <link rel="stylesheet" href="./style.css" />
    <link rel="icon" href="/favicon.svg" />
  </head>
  <body>
    <main><slot></slot></main>
  </body>
</html>
`;

function read(html: string, extra: Record<string, string> = { "code/style.css": "" }) {
  const root = mkdtempSync(join(tmpdir(), "sitez-"));
  for (const [file, content] of Object.entries({ "code/index.html": html, ...extra })) {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  try {
    return readFrame(root);
  } catch (error) {
    if (error instanceof SiteError) return error;
    throw error;
  }
}

describe("readFrame", () => {
  test("is the HTML with a marker where the page goes, and the stylesheets it links", () => {
    const result = read(frame);
    expect(result).not.toBeInstanceOf(Error);
    const { html, styles } = result as Exclude<typeof result, SiteError>;
    expect(html).toContain(`<main>${SLOT}</main>`);
    expect(html).not.toContain("<slot>");
    expect(styles.map((style) => style.href)).toEqual(["./style.css"]);
  });

  test("takes a slot written with its end tag, or with a slash", () => {
    for (const slot of ["<slot></slot>", "<slot> </slot>", "<slot />"]) {
      const result = read(frame.replace("<slot></slot>", slot));
      expect((result as { html: string }).html).toContain(`<main>${SLOT}</main>`);
    }
  });

  test.each([
    [
      "no lang",
      frame.replace(' lang="en"', ""),
      /^<html> has no lang\. Add it, such as <html lang="en">/,
    ],
    ["an empty lang", frame.replace('lang="en"', 'lang=""'), /^<html> has no lang/],
    [
      "no charset",
      frame.replace('    <meta charset="utf-8" />\n', ""),
      /^there's no charset\. Add <meta charset="utf-8" \/>/,
    ],
    [
      "no viewport",
      frame.replace(/ *<meta name="viewport".*\n/, ""),
      /^there's no viewport\. Add <meta name="viewport" content="width=device-width, initial-scale=1" \/>/,
    ],
    ["no title", frame.replace("    <title>My Site</title>\n", ""), /^there's no <title>\./],
    [
      "no description",
      frame.replace(/ *<meta name="description".*\n/, ""),
      /^there's no description\./,
    ],
    ["no slot", frame.replace("<slot></slot>", ""), /^there's no <slot><\/slot>\./],
    ["two slots", frame.replace("</main>", "</main><slot></slot>"), /^there are 2 slots/],
    [
      "a canonical link",
      frame.replace("</head>", '<link rel="canonical" href="/" /></head>'),
      /^this writes a canonical link, but Sitez writes it for every page, from the page's URL\. Remove <link rel="canonical" href="\/" \/>$/,
    ],
    [
      "an Open Graph tag",
      frame.replace("</head>", '<meta property="og:title" content="x" /></head>'),
      /^this writes an Open Graph tag.*Remove <meta property="og:title" content="x" \/>$/,
    ],
    [
      "a Twitter tag",
      frame.replace("</head>", '<meta name="twitter:card" content="summary" /></head>'),
      /^this writes a Twitter tag/,
    ],
  ])("fails on %s, naming code/index.html", (_, html, message) => {
    const error = read(html);
    expect(error).toBeInstanceOf(SiteError);
    expect((error as SiteError).file).toMatch(/code\/index\.html$/);
    expect((error as SiteError).message).toMatch(message);
  });

  test("sees a tag in a comment or a script as text", () => {
    const html = frame.replace(
      "</body>",
      '<!-- <link rel="canonical" href="/"> --><script>"<meta property=og:x>"</script></body>',
    );
    expect(read(html)).not.toBeInstanceOf(Error);
  });

  test("fails on no frame at all, and on a stylesheet that isn't there", () => {
    const root = mkdtempSync(join(tmpdir(), "sitez-"));
    expect(() => readFrame(root)).toThrow("this is missing.");
    expect((read(frame, {}) as SiteError).message).toBe(
      `<link href="./style.css"> isn't a file. Stylesheets are found from code/, so write the path to one there.`,
    );
  });

  test("leaves a stylesheet by a full path or a host to the site", () => {
    const html = frame.replace(
      './style.css" />',
      '/fonts.css" /><link rel="stylesheet" href="https://fonts.example.com/x.css" />',
    );
    expect((read(html, {}) as { styles: unknown[] }).styles).toEqual([]);
  });
});

describe("withStyles", () => {
  test("changes each relative stylesheet link, and nothing else", () => {
    const html =
      '<link rel="stylesheet" href="./a.css"><link rel="icon" href="x.svg"><link rel=stylesheet href=b.css>';
    expect(withStyles(html, (href) => `/${href.replace("./", "")}.hash`)).toBe(
      '<link rel="stylesheet" href="/a.css.hash"><link rel="icon" href="x.svg"><link rel=stylesheet href="/b.css.hash">',
    );
  });
});

describe("pageHead", () => {
  const site = { url: "https://example.com/" };
  const [html] = [read(frame) as { html: string }].map((read) => read.html);
  const head = (page: object) => pageHead(html!, { url: "/about/", ...page }, site);

  test("puts the page's title and description in place of the frame's", () => {
    const out = head({ title: "About & me", description: 'Who "I" am' });
    expect(out).toContain("<title>About &amp; me</title>");
    expect(out).toContain('<meta name="description" content="Who &quot;I&quot; am" />');
    expect(out).not.toContain("My Site");
  });

  test("keeps the frame's own for a page that sets neither, and says the same in the social tags", () => {
    const out = head({});
    expect(out).toContain("<title>My Site</title>");
    expect(out).toContain('<meta property="og:title" content="My Site">');
    expect(out).toContain('<meta name="twitter:description" content="The site\'s own.">');
  });

  test("writes the canonical link and the seven tags, at the end of the head", () => {
    const out = head({ title: "About", description: "Me" });
    const tags = out.slice(out.indexOf('<link rel="canonical"'), out.indexOf("</head>"));
    expect(
      tags
        .trim()
        .split("\n")
        .map((line) => line.trim()),
    ).toEqual([
      '<link rel="canonical" href="https://example.com/about/">',
      '<meta property="og:title" content="About">',
      '<meta property="og:description" content="Me">',
      '<meta property="og:url" content="https://example.com/about/">',
      '<meta property="og:type" content="website">',
      '<meta name="twitter:card" content="summary">',
      '<meta name="twitter:title" content="About">',
      '<meta name="twitter:description" content="Me">',
    ]);
  });

  test("leaves the 404 page with no canonical link and no og:url", () => {
    const out = pageHead(html!, { url: "/404/" }, site);
    expect(out).not.toContain("canonical");
    expect(out).not.toContain("og:url");
    expect(out).toContain("og:title");
  });

  test("writes a redirect's head as a refresh, the canonical link and noindex", () => {
    const out = pageHead(html!, { url: "/about/", title: "About" }, site, true);
    expect(out).toContain('<meta http-equiv="refresh" content="0; url=/about/">');
    expect(out).toContain('<link rel="canonical" href="https://example.com/about/">');
    expect(out).toContain('<meta name="robots" content="noindex">');
    expect(out).not.toContain("og:");
  });

  test("puts a tag after the description when a frame has no </head>", () => {
    const bare = '<meta name="description" content="x"><p>Hi</p>';
    expect(addToHead(bare, "<b>")).toBe('<meta name="description" content="x">\n<b><p>Hi</p>');
  });
});
