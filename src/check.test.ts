/** @prose
 * # Checking a site
 *
 * `sitez check` on copies of the example sites: what it fixes, what it reports, and how it names
 * each file.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { check } from "./check.ts";

describe("sitez check", { timeout: 60_000 }, () => {
  test("a second run finds nothing to fix and nothing wrong", async () => {
    const site = copy("landing");
    await check(site);
    expect(await check(site)).toEqual({ formatted: [], problems: [] });
  });

  test.each(["blog", "elements"])("the %s example has nothing wrong", async (name) => {
    expect((await check(copy(name))).problems).toEqual([]);
  });

  test("fixes what is safe, names it, and reports the rest, named from where it runs", async () => {
    const site = copy("landing");
    mkdirSync(join(site, "text"));
    writeFileSync(join(site, "text", "about.md"), "# About\n\nSome *stars*.\n");
    writeFileSync(join(site, "code", "_count.js"), "export const count = 1;\ndebugger;\n");
    writeFileSync(join(site, "code", "_messy.js"), "export const messy   =  1\n");
    const { formatted, problems } = await check(site, { cwd: join(site, "code") });
    expect(formatted).toEqual(expect.arrayContaining(["_messy.js", "../text/about.md"]));
    // Formatting writes Markz's canonical `_emphasis_`, so that warning is fixed too.
    expect(readFileSync(join(site, "text", "about.md"), "utf8")).toBe("# About\n\nSome _stars_.\n");
    expect(problems.some((line) => /^_count\.js:2:\d+: .*debugger/i.test(line))).toBe(true);
    expect(problems.some((line) => line.includes("about.md"))).toBe(false);
  });
});

function copy(name: string): string {
  const site = join(mkdtempSync(join(tmpdir(), "sitez-check-")), name);
  cpSync(join(import.meta.dirname, "../tests/sites", name), site, { recursive: true });
  return site;
}
