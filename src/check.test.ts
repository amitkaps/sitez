import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { check } from "./check.ts";

// svelte-check starts TypeScript, which takes seconds.
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
    mkdirSync(join(site, "prose"));
    writeFileSync(join(site, "prose", "about.md"), "# About\n\nSome *stars*.\n");
    writeFileSync(
      join(site, "pattern", "Count.svelte"),
      '<script lang="ts">\n\tconst label: string = 1;\n\tdebugger;\n</script>\n\n<p>{label}</p>\n',
    );
    writeFileSync(join(site, "pattern", "Messy.svelte"), '<p   class="x">Messy</p>\n');
    const { formatted, problems } = await check(site, { cwd: join(site, "pattern") });
    expect(formatted).toEqual(expect.arrayContaining(["Messy.svelte", "../prose/about.md"]));
    // Formatting writes Markz's canonical `_emphasis_`, so that warning is fixed too.
    expect(readFileSync(join(site, "prose", "about.md"), "utf8")).toBe(
      "# About\n\nSome _stars_.\n",
    );
    expect(problems.some((line) => /^Count\.svelte:3:\d+: .*debugger/i.test(line))).toBe(true);
    expect(problems).toContain(
      "Count.svelte:2:9: Type 'number' is not assignable to type 'string'.",
    );
    expect(problems.some((line) => line.includes("about.md"))).toBe(false);
  });

  test("checks plain JS as TypeScript would, without asking for types", async () => {
    const site = copy("landing");
    writeFileSync(
      join(site, "pattern", "Plain.svelte"),
      "<script>\n  const n = 1;\n  n.toUpperCase();\n  const pick = function (event) {\n    return event.target.value;\n  };\n</script>\n\n<input oninput={pick} />\n",
    );
    const { problems } = await check(site);
    expect(problems).toEqual([
      "pattern/Plain.svelte:3:5: Property 'toUpperCase' does not exist on type '1'.",
    ]);
  });
});

function copy(name: string): string {
  const site = join(mkdtempSync(join(tmpdir(), "sitez-check-")), name);
  cpSync(join(import.meta.dirname, "../test/sites", name), site, { recursive: true });
  return site;
}
