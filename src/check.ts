/** @prose
 * # Check
 *
 * `sitez check`: the site's files put right where that's safe, then whatever is left that needs
 * the author. oxlint applies its safe fixes to `code/`, and oxfmt formats `text/` and `code/` in
 * one style. Its Markdown output is Markz's canonical form. Then Markz's warnings, which `build`
 * prints but never fails on, are problems here. The files it formatted are named. Every problem is
 * one line, `file:line:col: message`, named from where `sitez` runs, and any problem fails.
 *
 * Nothing type-checks `code/` yet ([design.md](../docs/design.md#open-questions)). The style is
 * oxfmt's defaults (`runtime/oxfmtrc.json`), so an editor running oxfmt with no config of its own
 * agrees with it. oxfmt and oxlint are the ones
 * Vite+ vendors, so they stay the versions the rest of Sitez's toolchain was released with.
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parse } from "@amitkaps/markz";
import { discover } from "./discover.ts";
import { shownFrom } from "./errors.ts";
import { SITE_FILE } from "./root.ts";
import { runtime } from "./vite.ts";
import { formatWarning, markzWarnings } from "./warnings.ts";

export interface CheckResult {
  /** The files it formatted, named from where `sitez` runs. */
  formatted: string[];
  /** One line per problem left, in the order the tools ran. */
  problems: string[];
}

export async function check(root: string, { cwd = root } = {}): Promise<CheckResult> {
  const shown = shownFrom(cwd);
  const has = (folder: string) => existsSync(join(root, folder));
  const folders = ["text", "code"].filter(has);
  const config = ["-c", join(runtime, "oxfmtrc.json")];

  // Fixes first, one after the other, since each changes files: lint's, then formatting its result.
  const lint = has("code") ? await tool("oxlint", ["-f", "unix", "--fix", "code"], root) : "";
  let formatted: string[] = [];
  if (folders.length > 0) {
    formatted = lines(await tool("oxfmt", [...config, "--list-different", ...folders], root));
    if (formatted.length > 0) await tool("oxfmt", [...config, "--write", ...folders], root);
  }

  const markz = () =>
    [
      join(root, SITE_FILE),
      ...discover(root)
        .filter((page) => page.kind === "text")
        .map((page) => page.file),
    ]
      .flatMap((file) => markzWarnings(file, parse(readFileSync(file, "utf8"))))
      .map((warning) => formatWarning(warning, shown));
  const warnings = markz();
  const linted = lines(lint).flatMap((line) => {
    const found = /^(.+?):(\d+):(\d+): (.*)$/.exec(line);
    return found ? [`${shown(join(root, found[1]!))}:${found[2]}:${found[3]}: ${found[4]}`] : [];
  });
  return {
    formatted: formatted.map((file) => shown(join(root, file))),
    problems: [...linted, ...warnings],
  };
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** @prose
 * The tools are Sitez's own dependencies, run with the Node running Sitez, from the site's root.
 * A tool exits non-zero when it finds problems, which is its answer, not a failure.
 */
function tool(name: string, args: string[], cwd: string): Promise<string> {
  const bin = binOf(name);
  return new Promise((done, fail) => {
    execFile(
      process.execPath,
      [bin, ...args],
      { cwd, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== "number") {
          fail(new Error(`${name} didn't run: ${error.message}\n${stderr}`));
        } else {
          done(stdout);
        }
      },
    );
  });
}

/** oxfmt and oxlint come with Vite+, at its versions. */
function binOf(name: string): string {
  const sitez = createRequire(import.meta.url);
  const vitePlus = createRequire(sitez.resolve("vite-plus/package.json"));
  for (const require of [sitez, vitePlus]) {
    for (const folder of require.resolve.paths(name) ?? []) {
      const bin = join(folder, name, "bin", name);
      if (existsSync(bin)) return bin;
    }
  }
  throw new Error(`Sitez can't find ${name}, which it depends on. Reinstall Sitez.`);
}
