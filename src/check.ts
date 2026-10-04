/** @prose
 * # Check
 *
 * `sitez check`: the site's files put right where that's safe, then whatever is left that needs
 * the author. oxlint applies its safe fixes to `code/` and oxfmt formats `text/` and `code/` in
 * one style, its Markdown output being Markz's canonical form; then svelte-check type-checks
 * `code/`, and Markz's warnings, which `build` prints but never fails on, are
 * problems here. The files it formatted are named; every problem is one line,
 * `file:line:col: message`, named from where `sitez` runs, and any problem fails.
 *
 * The style is oxfmt's defaults with Svelte formatting turned on (`runtime/oxfmtrc.json`), so an
 * editor running oxfmt with no config of its own agrees with it. oxfmt and oxlint are the ones
 * Vite+ vendors, so they stay the versions the rest of Sitez's toolchain was released with.
 */
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parse } from "@amitkaps/markz";
import { discover } from "./discover.ts";
import { shownFrom } from "./errors.ts";
import { SITE_FILE } from "./root.ts";
import { cacheDir, runtime, svelteOptions } from "./vite.ts";
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
  const types = has("code") ? await svelteCheck(root, shown) : [];
  const warnings = markz();
  const linted = lines(lint).flatMap((line) => {
    const found = /^(.+?):(\d+):(\d+): (.*)$/.exec(line);
    return found ? [`${shown(join(root, found[1]!))}:${found[2]}:${found[3]}: ${found[4]}`] : [];
  });
  return {
    formatted: formatted.map((file) => shown(join(root, file))),
    problems: [...linted, ...types, ...warnings],
  };
}

/** @prose
 * svelte-check needs no `tsconfig` or `node_modules` in the site: it resolves Svelte's types
 * itself. It runs in a folder of Sitez's, in the cache folder, holding links to `code/` and `data/`, a
 * `tsconfig` and a Svelte config that compiles as Sitez does: svelte-check looks for a config up
 * the tree from each file, so a site inside a larger repo would otherwise be checked by that
 * repo's. It is strict, and plain-JS scripts are checked too, as strictly, except that nothing
 * has to be given a type: a parameter without one is left alone, in `lang="ts"` as in JS, so a
 * site written without types is checked for what is wrong, not for what is missing.
 * Svelte's `state_referenced_locally` is ignored, since a page renders once and an
 * island's props are set once, from the server, so reading one at the top of a script is always
 * what's meant.
 */
async function svelteCheck(root: string, shown: (file: string) => string): Promise<string[]> {
  const real = realpathSync(root);
  const workspace = join(cacheDir(real), "check");
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(workspace, { recursive: true });
  for (const folder of ["code", "data"]) {
    if (existsSync(join(real, folder)))
      symlinkSync(join(real, folder), join(workspace, folder), "dir");
  }
  writeFileSync(
    join(workspace, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "esnext",
        module: "esnext",
        moduleResolution: "bundler",
        strict: true,
        allowJs: true,
        checkJs: true,
        noImplicitAny: false,
        skipLibCheck: true,
        noEmit: true,
        allowImportingTsExtensions: true,
        preserveSymlinks: true,
        types: [],
      },
      include: ["code/**/*"],
    }),
  );
  writeFileSync(
    join(workspace, "svelte.config.js"),
    `export default { compilerOptions: ${JSON.stringify(svelteOptions)} };\n`,
  );
  const out = await tool(
    "svelte-check",
    [
      "--workspace",
      workspace,
      "--output",
      "machine",
      "--compiler-warnings",
      "state_referenced_locally:ignore",
    ],
    workspace,
  );
  return lines(out).flatMap((line) => {
    const found = /^\d+ (ERROR|WARNING) "(.+?)" (\d+):(\d+) (".*")$/.exec(line);
    if (!found) return [];
    const message = (JSON.parse(found[5]!) as string).split("\n")[0];
    return [`${shown(join(root, found[2]!))}:${found[3]}:${found[4]}: ${message}`];
  });
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

/** svelte-check is Sitez's own dependency; oxfmt and oxlint come with Vite+, at its versions. */
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
