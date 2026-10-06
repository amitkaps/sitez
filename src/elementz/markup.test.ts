/** @prose
 * # Reading HTML's tags
 *
 * Where the tags are, with their attributes, and what isn't a tag: a comment, text in a script, a
 * `<` in a value. Offsets let a caller replace a value without rewriting the rest.
 */
import { describe, expect, test } from "vite-plus/test";
import { attribute, decode, encode, scan, withValue } from "./markup.ts";

const names = (html: string) =>
  scan(html).map((tag) => `${tag.kind === "end" ? "/" : ""}${tag.name}`);

describe("scan", () => {
  test("finds start and end tags in order, lowercase", () => {
    expect(names("<P>Hello <Call-Out type=note>x</Call-Out><br></P>")).toEqual([
      "p",
      "call-out",
      "/call-out",
      "br",
      "/p",
    ]);
  });

  test("reads attributes, quoted either way or bare, with where their values sit", () => {
    const html = `<meta name="description" content='A > B' data-x=1 hidden>`;
    const [tag] = scan(html);
    expect(tag!.attributes.map((a) => [a.name, a.value, a.quoted])).toEqual([
      ["name", "description", true],
      ["content", "A > B", true],
      ["data-x", "1", false],
      ["hidden", undefined, false],
    ]);
    const content = attribute(tag!, "content")!;
    expect(html.slice(content.valueStart, content.valueEnd)).toBe("A > B");
    expect(withValue(html, content, "New")).toBe(
      `<meta name="description" content='New' data-x=1 hidden>`,
    );
    const bare = attribute(tag!, "data-x")!;
    expect(withValue(html, bare, "2")).toContain(`data-x="2" hidden`);
    expect(tag!.end).toBe(html.length);
  });

  test("reads <x /> as self-closing", () => {
    expect(scan("<card-list data=a.json />")[0]).toMatchObject({ selfClosing: true });
    expect(scan("<a-b></a-b>")[0]).toMatchObject({ selfClosing: false });
  });

  test("ignores comments, doctypes, and the text of a script, style, textarea or title", () => {
    expect(
      names(
        "<!doctype html><!-- <a-b> --><title><a-b></title><script>if (a < b) '<c-d>'</script>" +
          "<style>a-b::after { content: '<e-f>' }</style><textarea><g-h></textarea><i-j>",
      ),
    ).toEqual([
      "title",
      "/title",
      "script",
      "/script",
      "style",
      "/style",
      "textarea",
      "/textarea",
      "i-j",
    ]);
  });

  test("takes a lone < for text", () => {
    expect(names("<p>1 < 2 and 3 <4</p>")).toEqual(["p", "/p"]);
  });
});

describe("decode and encode", () => {
  test("decode reads the entities an attribute has", () => {
    expect(decode("a &amp; b &lt; c &quot;d&quot; &#39;e&#x27; &apos;")).toBe(
      "a & b < c \"d\" 'e' '",
    );
    expect(decode("&unknown; &#0;")).toBe("&unknown; &#0;");
  });

  test("encode writes a value for double quotes", () => {
    expect(encode(`a & b < "c" > d`)).toBe("a &amp; b &lt; &quot;c&quot; &gt; d");
  });
});
