/** @prose
 * # Deploy
 *
 * `sitez deploy`: build, then publish `dist/` to the repo's `gh-pages` branch with the author's
 * own git and credentials, when the repo's remote is on GitHub. It builds first, so what's
 * published is never older than the source. The branch keeps its history, one commit a deploy,
 * named for the source commit it came from, so a bad deploy can be found and reverted. A site on
 * any other host needs no Sitez command: Cloudflare, for one, runs `npx sitez build` itself.
 */
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, type BuildResult } from "./build.ts";
import { SiteError } from "./errors.ts";

export interface Deployed {
  build: BuildResult;
  remote: string;
  /** False when `dist/` was already what `gh-pages` holds. */
  changed: boolean;
}

export async function deploy(root: string): Promise<Deployed> {
  const remote = await git(root, ["remote", "get-url", "origin"]).then(
    (url) => url.trim(),
    () => undefined,
  );
  if (!remote || !isGitHub(remote)) {
    throw new SiteError(
      root,
      `sitez deploy publishes to GitHub Pages, and ${remote ? `this repo's remote (${remote}) isn't on GitHub` : "this site isn't in a git repo with a remote named origin"}. To host it elsewhere, build with sitez build and publish dist/: Cloudflare, for one, runs npx sitez build itself.`,
    );
  }
  const result = await build(root);
  const source = await git(root, ["rev-parse", "--short", "HEAD"]).then(
    (sha) => sha.trim(),
    () => "an uncommitted tree",
  );

  /** @prose
   * The branch is cloned into a temp folder, so the author's own checkout is never touched, and
   * its files are replaced with `dist/`'s. `.nojekyll` tells GitHub Pages to serve the files as
   * they are, `_`-prefixed ones included.
   */
  const work = join(mkdtempSync(join(tmpdir(), "sitez-deploy-")), "gh-pages");
  const cloned = await git(root, [
    "clone",
    "--quiet",
    "--depth",
    "1",
    "--branch",
    "gh-pages",
    remote,
    work,
  ]).then(
    () => true,
    () => false,
  );
  if (!cloned) {
    await git(root, ["init", "--quiet", work]);
    await git(work, ["checkout", "--quiet", "-b", "gh-pages"]);
  }
  for (const entry of readdirSync(work)) {
    if (entry !== ".git") rmSync(join(work, entry), { recursive: true, force: true });
  }
  cpSync(result.outDir, work, { recursive: true });
  writeFileSync(join(work, ".nojekyll"), "");
  await git(work, ["add", "--all"]);
  const status = await git(work, ["status", "--porcelain"]);
  if (status.trim() === "") {
    rmSync(work, { recursive: true, force: true });
    return { build: result, remote, changed: false };
  }
  await git(work, ["commit", "--quiet", "-m", `Deploy ${source}`]);
  await git(work, ["push", "--quiet", remote, "HEAD:gh-pages"]).catch((error: SiteError) => {
    throw new SiteError(root, error.message);
  });
  rmSync(work, { recursive: true, force: true });
  return { build: result, remote, changed: true };
}

/** `https://github.com/…`, `git@github.com:…` and `ssh://git@github.com/…` are all GitHub. */
export function isGitHub(remote: string): boolean {
  return /(^|[@/.])github\.com[:/]/.test(remote);
}

/** A git failure is the author's to fix (credentials, a protected branch), so it's a message. */
function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd }, (error, stdout, stderr) => {
      if (!error) return resolve(stdout);
      reject(new SiteError(cwd, `git ${args[0]} failed: ${stderr.trim() || error.message}`));
    });
  });
}
