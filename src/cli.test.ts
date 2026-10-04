import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import pkg from "../package.json" with { type: "json" };
import { run } from "./cli.ts";

const blog = join(import.meta.dirname, "../tests/sites/blog");

async function sitez(argv: string[], cwd = blog) {
  const lines = { log: [] as string[], error: [] as string[] };
  const out = {
    log: (s: string) => lines.log.push(s),
    error: (s: string) => lines.error.push(s),
  } as unknown as Console;
  const code = await run(argv, cwd, out);
  return { code, log: lines.log.join("\n"), error: lines.error.join("\n") };
}

describe("sitez", () => {
  test("lists the five commands", async () => {
    const { code, log } = await sitez(["--help"]);
    expect(code).toBe(0);
    for (const name of ["dev", "build", "preview", "check", "deploy"]) expect(log).toContain(name);
  });

  test("with no command, shows usage and fails", async () => {
    const { code, log } = await sitez([]);
    expect(code).toBe(1);
    expect(log).toMatch(/^Usage: sitez <command>/);
  });

  test("prints its version", async () => {
    expect((await sitez(["--version"])).log).toBe(pkg.version);
  });

  test("rejects an unknown command", async () => {
    const { code, error } = await sitez(["serve"]);
    expect(code).toBe(1);
    expect(error).toMatch(/^sitez: unknown command 'serve'/);
  });

  test("builds, printing Markz warnings named from where it runs", async () => {
    const root = mkdtempSync(join(tmpdir(), "sitez-"));
    mkdirSync(join(root, "text"));
    writeFileSync(join(root, "site.md"), "---\nname: Test\nurl: https://example.com\n---\n");
    writeFileSync(join(root, "text/index.md"), "# Home\n\nSome *stars*.\n");
    writeFileSync(
      join(root, "package.json"),
      '{ "devDependencies": { "@amitkaps/sitez": "0.2.0" } }\n',
    );
    const { code, log, error } = await sitez(["build"], join(root, "text"));
    expect(code).toBe(0);
    expect(error).toBe("index.md:3:6: `*emphasis*`, write `_emphasis_` instead (star-emphasis)");
    // A second or more, on a busy machine, reads as seconds.
    expect(log).toMatch(
      /^page +html +js +time\n\/ +[\d.]+ KB +— +[\d.]+ m?s\ncommon +[\d.]+ KB css\n1 page in [\d.]+ m?s → \.\.\/dist · sitez [\d.]+$/,
    );
  });

  test("fails in a site whose package.json doesn't name sitez, showing the line to add", async () => {
    const root = mkdtempSync(join(tmpdir(), "sitez-"));
    writeFileSync(join(root, "site.md"), "---\nname: Test\nurl: https://example.com\n---\n");
    const missing = await sitez(["build"], root);
    expect(missing.code).toBe(1);
    expect(missing.error).toContain(
      `sitez: no package.json beside site.md or in any folder above. Add one naming the Sitez that builds this site:\n\n{ "devDependencies": { "@amitkaps/sitez": "${pkg.version}" } }`,
    );
    writeFileSync(join(root, "package.json"), '{ "devDependencies": { "lodash": "4.0.0" } }\n');
    const unnamed = await sitez(["check"], root);
    expect(unnamed.code).toBe(1);
    expect(unnamed.error).toContain(
      `package.json: doesn't name @amitkaps/sitez. Add this line to its "devDependencies":\n\n"@amitkaps/sitez": "${pkg.version}"`,
    );
  });

  test("reads the nearest package.json above a site in a folder", async () => {
    const repo = mkdtempSync(join(tmpdir(), "sitez-"));
    mkdirSync(join(repo, "site/text"), { recursive: true });
    writeFileSync(
      join(repo, "package.json"),
      '{ "devDependencies": { "@amitkaps/sitez": "0.2.0" } }\n',
    );
    writeFileSync(join(repo, "site/site.md"), "---\nname: Test\nurl: https://example.com\n---\n");
    writeFileSync(join(repo, "site/text/index.md"), "# Home\n");
    expect((await sitez(["build"], join(repo, "site"))).code).toBe(0);
  });

  test("fails outside a site", async () => {
    const empty = mkdtempSync(join(tmpdir(), "sitez-"));
    const { code, error } = await sitez(["build"], empty);
    expect(code).toBe(1);
    expect(error).toMatch(/^sitez: no site\.md here/);
  });
});
