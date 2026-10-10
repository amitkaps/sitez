# Working on this repo

How to work in Sitez: what to read first, the rules the project holds, the standard and prose
rules every repository shares, and how this one applies them.

Read **`docs/idea.md`**, **`docs/sitez.md`** and **`docs/elementz.md`** first. They say what
Sitez promises, how it is built, and what an element is. **`docs/plan.md`** is the order the work happens in.

- `idea.md` is the spec. Its promises and rules are what users rely on, and `sitez.md` and
  `elementz.md` can change underneath them. A change that breaks a promise, or builds something listed in "Not in
  v1", is the human's decision. Say so instead of building it.
- Sitez takes no options. When a feature seems to need one, look for the convention
  that makes it unnecessary, or ask. `site.md` holds metadata, never settings.
- Every failure a user can cause (a broken link, a function in a build-time template, a reserved
  file name) fails the build. Its message names the file and what to change. Never guess silently.

## Standard

This repository follows the standard at [ship](https://ship.amitkaps.com), which sets how every repository builds, checks and deploys. Read [ship's docs/standard.md](https://github.com/amitkaps/ship/blob/main/docs/standard.md) before changing any of that.

- Change the toolchain, scripts, versions or deploys in ship first, then bring each repository in line. Don't change them in one repository alone.
- Work on a branch and open a pull request. CI runs `pnpm run verify`, which must pass, and the pull request is squash-merged. Nobody pushes to `main`.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs.
- A held check on ship's page is a tool's limit, not a choice. Leave it until its reason goes away.

## Prose

Explanations go in `@prose` comments, written to the rules in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents). Read them before writing prose. They live there and aren't copied here, so every repository writes to the same rules.


## Reading the codebase

Read the map before the code. The prose is kept current with the code, so its first paragraphs
tell you what each part means without loading it.

1. `docs/*.md` for the design across the codebase.
2. A folder's `README.md` for what the folder holds.
3. The first paragraph of each file's `@prose` block (`grep -rn -A4 "@prose" src`) to find the
   file that matters.
4. The code itself only for the chunks you will change.

If the prose you read turns out to be wrong about the code, fixing it is part of the change.

## This repository's prose

`pnpm prose` reads the result as a document.


- `docs/` holds the writing that spans files: [idea](docs/idea.md) (the spec), [sitez](docs/sitez.md) and [elementz](docs/elementz.md) (how it's built, and what was ruled out), [pagez](docs/pagez.md) (the single-page layer's idea) and [plan](docs/plan.md) (the order of the work). Reference a section by file and heading (`docs/idea.md#the-rules`). Rules are the one exception, cited by number (rule 6), since idea.md numbers them.
- Work that belongs to one file goes in as a pending `@prose` chunk there, not as a line in the plan.
- Tests carry file prose too: what the file covers, in a line or two.
- Run `pnpm check` and `pnpm test` before opening a pull request.
