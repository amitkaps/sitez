/** @prose
 * # Data
 *
 * What a `data` attribute names (rule 5). `{@card-grid data="talks.json"}` reads `data/talks.json`
 * and hands the element what it parses to. The path is checked like a link. A file that isn't
 * there, one outside `data/` and one that isn't JSON each fail naming the line, rather than
 * giving the element nothing. JSON is the only format, and CSV is parked
 * ([idea.md](../docs/idea.md#parked-ideas)).
 */
import { readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { skipped } from "./discover.ts";

/** The parsed JSON `path` names in `root`'s `data/`, or what is wrong with the path. */
export function readData(root: string, path: string): { value: unknown } | { problem: string } {
  const folder = join(root, "data");
  const file = resolve(folder, path);
  const written = `data="${path}"`;
  if (!file.startsWith(folder + sep)) {
    return { problem: `${written} is outside data/. Name a file inside it.` };
  }
  if (skipped(folder, file)) {
    return {
      problem: `${written} is skipped, since a name starting with _ is never read. Rename the file.`,
    };
  }
  if (extname(file) !== ".json") {
    return { problem: `${written} isn't JSON, which is the one format data/ holds.` };
  }
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
    return { problem: `${written} isn't there: no file at ${relative(root, file)}.` };
  }
  try {
    return { value: JSON.parse(readFileSync(file, "utf8")) };
  } catch (error) {
    return { problem: `${written} isn't valid JSON: ${(error as Error).message}` };
  }
}
