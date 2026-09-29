/** @prose
 * # The build report
 *
 * What `build` prints when it's done (promise 5): each page's cost to send, gzipped, and to
 * build, so a page that grows heavy or slow is visible where the cost is. A page's `js` is only
 * its own; what pages share is one `common` row, since the browser downloads it once. The last
 * line is the whole build and its islands.
 *
 * ```text
 * page         html      js   time
 * /          4.0 KB       —  12 ms
 * /blog/     6.1 KB  5.0 KB  20 ms
 * /quality/   90 KB   14 KB  1.2 s  raw <script>
 * common     3.0 KB css, 12 KB js
 * 42 pages in 1.8 s → dist · islands: QualityReport, TagFilter
 * ```
 */
import type { BuildResult } from "./build.ts";

export function report(result: BuildResult, outDir: string): string {
  const rows = [
    ["page", "html", "js", "time", ""],
    ...result.pages.map((page) => [
      page.url,
      size(page.html),
      page.js ? size(page.js) : "—",
      time(page.ms),
      page.notes.join(", "),
    ]),
  ];
  const widths = [0, 1, 2, 3].map((i) => Math.max(...rows.map((row) => row[i]!.length)));
  const lines = rows.map((row) =>
    [
      row[0]!.padEnd(widths[0]!),
      row[1]!.padStart(widths[1]!),
      row[2]!.padStart(widths[2]!),
      row[3]!.padStart(widths[3]!),
      row[4],
    ]
      .join("  ")
      .trimEnd(),
  );
  const common = [`${size(result.common.css)} css`];
  if (result.common.js) common.push(`${size(result.common.js)} js`);
  lines.push(`${"common".padEnd(widths[0]!)}  ${common.join(", ")}`);
  const n = result.pages.length;
  const total = [`${n} ${n === 1 ? "page" : "pages"} in ${time(result.ms)} → ${outDir}`];
  if (result.islands.length > 0) total.push(`islands: ${result.islands.join(", ")}`);
  lines.push(total.join(" · "));
  return lines.join("\n");
}

/** Kilobytes, to one decimal below 10 KB, where a tenth still means something. */
export function size(bytes: number): string {
  const kb = bytes / 1024;
  return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
}

export function time(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
