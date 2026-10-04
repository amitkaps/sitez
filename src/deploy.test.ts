import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import { deploy, isGitHub } from "./deploy.ts";
import { SiteError } from "./errors.ts";

// The author's git runs these, so it needs an identity wherever the tests run.
beforeAll(() => {
  for (const who of ["AUTHOR", "COMMITTER"]) {
    process.env[`GIT_${who}_NAME`] = "Sitez Test";
    process.env[`GIT_${who}_EMAIL`] = "test@example.com";
  }
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

// Each deploy builds the site, and the first test deploys three times.
describe("sitez deploy", { timeout: 60_000 }, () => {
  test("builds and pushes dist/ to gh-pages, one commit a deploy", async () => {
    const temp = mkdtempSync(join(tmpdir(), "sitez-deploy-"));
    // A bare repo standing in for GitHub: its path is what the remote check reads.
    const remote = join(temp, "github.com", "someone", "site.git");
    mkdirSync(remote, { recursive: true });
    git(remote, "init", "--quiet", "--bare");
    const site = join(temp, "site");
    cpSync(join(import.meta.dirname, "../tests/sites/landing"), site, { recursive: true });
    git(site, "init", "--quiet");
    git(site, "add", "--all");
    git(site, "commit", "--quiet", "-m", "Start");
    git(site, "remote", "add", "origin", remote);
    const source = git(site, "rev-parse", "--short", "HEAD");

    const first = await deploy(site);
    expect(first.changed).toBe(true);
    expect(git(remote, "log", "--format=%s", "gh-pages")).toBe(`Deploy ${source}`);
    const files = git(remote, "ls-tree", "-r", "--name-only", "gh-pages").split("\n");
    expect(files).toContain("index.html");
    expect(files).toContain(".nojekyll");
    expect(files).toContain("lantern.txt");

    expect((await deploy(site)).changed).toBe(false);

    writeFileSync(join(site, "public", "lantern.txt"), "Brighter.\n");
    expect((await deploy(site)).changed).toBe(true);
    expect(git(remote, "rev-list", "--count", "gh-pages")).toBe("2");
  });

  test("a site without a GitHub remote is told how to deploy instead", async () => {
    const site = join(mkdtempSync(join(tmpdir(), "sitez-deploy-")), "site");
    cpSync(join(import.meta.dirname, "../tests/sites/landing"), site, { recursive: true });
    git(site, "init", "--quiet");
    git(site, "remote", "add", "origin", "https://gitlab.com/someone/site.git");
    const error = await deploy(site).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(SiteError);
    expect((error as SiteError).message).toMatch(
      /^sitez deploy publishes to GitHub Pages, and this repo's remote \(https:\/\/gitlab\.com\/someone\/site\.git\) isn't on GitHub\./,
    );
  });
});

test.each([
  ["https://github.com/amitkaps/sitez.git", true],
  ["git@github.com:amitkaps/sitez.git", true],
  ["ssh://git@github.com/amitkaps/sitez.git", true],
  ["https://gitlab.com/amitkaps/sitez.git", false],
  ["https://notgithub.com/amitkaps/sitez.git", false],
])("%s is on GitHub: %s", (remote, expected) => {
  expect(isGitHub(remote)).toBe(expected);
});
