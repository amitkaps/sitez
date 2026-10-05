/** @prose
 * # The example sites
 *
 * Every site in `tests/sites/` is built. A site builds to the files in `tests/snapshots/<site>/`
 * (`files.txt` lists them, `built/` holds the text ones, and `warnings.txt` has Markz's warnings,
 * when it has any), which are reviewed as they change. An `error-…` site fails with exactly its
 * `error.txt`, which is reviewed as a snapshot is. Files are named relative to the site, as `vite build` prints them from there.
 * Each site is built the way `vite build` builds it, through its own `vite.config.js`.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { SiteError } from "../src/errors.ts";
import { buildSite } from "./build.ts";

const sites = join(import.meta.dirname, "sites");
const names = readdirSync(sites, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// Snapshots are what a person reviews; other files, bundled JavaScript among them, are listed by
// name only. `browser.test.ts` runs the JavaScript instead.
const text = /\.(html|css|xml|svg|txt|json)$/;

describe.each(names.filter((name) => !name.startsWith("error-")))("%s", (name) => {
  test("builds to its snapshot", async () => {
    const outDir = join(mkdtempSync(join(tmpdir(), "sitez-")), "dist");
    const root = join(sites, name);
    const { warnings } = await buildSite(root, outDir);
    const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(outDir, join(entry.parentPath, entry.name)))
      .sort();
    await expect(files.join("\n") + "\n").toMatchFileSnapshot(`snapshots/${name}/files.txt`);
    // A snapshot of a file the site no longer builds, such as an old hash, is stale.
    const built = join(import.meta.dirname, "snapshots", name, "built");
    const kept = existsSync(built)
      ? readdirSync(built, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => relative(built, join(entry.parentPath, entry.name)))
      : [];
    expect(kept.filter((file) => !files.includes(file))).toEqual([]);
    for (const file of files.filter((file) => text.test(file))) {
      await expect(readFileSync(join(outDir, file), "utf8")).toMatchFileSnapshot(
        `snapshots/${name}/built/${file}`,
      );
    }
    const snapshot = `snapshots/${name}/warnings.txt`;
    if (warnings.length > 0 || existsSync(join(import.meta.dirname, snapshot))) {
      await expect(warnings.map((line) => `${line}\n`).join("")).toMatchFileSnapshot(snapshot);
    }
  });
});

describe.each(names.filter((name) => name.startsWith("error-")))("%s", (name) => {
  test("fails with its error.txt", async () => {
    const root = join(sites, name);
    const outDir = join(mkdtempSync(join(tmpdir(), "sitez-")), "dist");
    const error = await buildSite(root, outDir).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(SiteError);
    const { file, message } = error as SiteError;
    await expect(`${relative(root, file)}: ${message}\n`).toMatchFileSnapshot(
      join(root, "error.txt"),
    );
  });
});
