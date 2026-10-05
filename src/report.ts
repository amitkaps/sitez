/** @prose
 * # The build report
 *
 * What `build` prints when it's done (promise 5): each page's cost to send, gzipped, and to
 * build, so a page that grows heavy or slow is visible where the cost is. What pages share is one
 * `common` row, since the browser downloads it once. That's the stylesheet, and the script for
 * the pages whose notes name a live element. The last line is the whole build, its live elements
 * and the version of Sitez that ran.
 *
 * ```text
 * page         html   time
 * /          4.0 KB  12 ms
 * /blog/     6.1 KB  20 ms  tag-filter
 * /quality/   90 KB  1.2 s  quality-report, raw <script>
 * common     3.0 KB css, 1.2 KB js, loads cdn.jsdelivr.net
 * 42 pages in 1.8 s → dist · live: quality-report, tag-filter · sitez 0.2.0
 * ```
 */
import type { BuildResult } from "./build.ts";

export function report(result: BuildResult, outDir: string, version: string): string {
  const rows = [
    ["page", "html", "time", ""],
    ...result.pages.map((page) => [
      page.url,
      size(page.html),
      time(page.ms),
      page.notes.join(", "),
    ]),
  ];
  const widths = [0, 1, 2].map((i) => Math.max(...rows.map((row) => row[i]!.length)));
  const lines = rows.map((row) =>
    [row[0]!.padEnd(widths[0]!), row[1]!.padStart(widths[1]!), row[2]!.padStart(widths[2]!), row[3]]
      .join("  ")
      .trimEnd(),
  );
  const common = [`${size(result.common.css)} css`];
  if (result.common.js) common.push(`${size(result.common.js)} js`);
  common.push(...result.common.hosts.map((host) => `loads ${host}`));
  lines.push(`${"common".padEnd(widths[0]!)}  ${common.join(", ")}`);
  const n = result.pages.length;
  const total = [`${n} ${n === 1 ? "page" : "pages"} in ${time(result.ms)} → ${outDir}`];
  if (result.live.length > 0) total.push(`live: ${result.live.join(", ")}`);
  total.push(`sitez ${version}`);
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
