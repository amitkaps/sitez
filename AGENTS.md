# Working on this repo

How to work in Sitez: what to read first, the rules the project holds, craftz's and prose's rules, which every repository shares, and how this one applies them.

Read **`docs/design.md`**, **`docs/sitez.md`** and **`docs/elementz.md`** first. They say what Sitez promises, how it is built, and what an element is. **`docs/plan.md`** is the order the work happens in.

- `design.md` is the spec. Its promises and rules are what users rely on, and `sitez.md` and `elementz.md` can change underneath them. A change that breaks a promise, or builds something listed in "Not in v1", is the human's decision. Say so instead of building it.
- Sitez takes no options. When a feature seems to need one, look for the convention that makes it unnecessary, or ask. `site.md` holds metadata, never settings.
- Every failure a user can cause (a broken link, a function in a build-time template, a reserved file name) fails the build. Its message names the file and what to change. Never guess silently.

## craftz

This repository follows [craftz's rules](https://craftz.amitkaps.com/docs/rules.md), which set how every repository builds, checks, deploys and releases. Run `pnpm craftz rules` before changing any of that. It prints the rules for the version this repository installs, and `pnpm craftz rules <id>` prints one.

- Change the toolchain, scripts, versions or deploys in craftz first, then bring each repository in line. Don't change them in one repository alone.
- Open a pull request with `pnpm pr "<title>"`. It branches from `main`, or adds to the branch's open pull request when given its title, then commits, runs `pnpm run verify`, pushes and turns on auto-merge, and the pull request is squash-merged once CI passes. Don't wait for the merge: start the next change, and its `pnpm pr` waits only if the last hasn't merged. Add `--wait` to the last change of a session, to end on `main`. `pnpm pr` first deletes the local branches that merged, and `pnpm gone` does that alone. Nobody pushes to `main`.
- To see what's live, run `pnpm craftz status`: CI, pull requests, the release and the site. `--notes` adds the release's notes, and `--log` the build's log. Use it rather than reading GitHub, npm or Cloudflare another way.
- In a package, give it one label for the release notes, `pnpm pr "<title>" --label <label>`: `breaking`, `added`, `fixed`, `improved`, `docs`, or `internal` for tests, tooling, site and lessons. CI fails without one.
- Run tools through `pnpm run …` and `pnpm exec`, not global installs.
- A held check is a tool's limit, not a choice. The rules give its reason, so leave it until the reason goes away.

## Prose

Explanations go in `@prose` comments. Run `pnpm prose rules` before writing prose, or changing code a `@prose` comment explains. It prints the rules for the version this repository uses, each with the codes that check it, and `pnpm prose rules <code>` says what one warning asks for. The rules live in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents) and aren't copied here, so every repository writes to the same rules.

After writing prose, run `pnpm prose style <files>` on the files you changed, and take its advice where it reads better. It always passes, so it's advice, not a check.

## Reading the codebase

Read the map before the code. The prose is kept current with the code, so its first paragraphs tell you what each part means without loading it.

1. `docs/*.md` for the design across the codebase.
2. A folder's `README.md` for what the folder holds.
3. The first paragraph of each file's `@prose` block (`grep -rn -A4 "@prose" src`) to find the file that matters.
4. The code itself only for the chunks you will change.

If the prose you read turns out to be wrong about the code, fixing it is part of the change.

## This repository's prose

`pnpm prose` reads the result as a document.

- `docs/` holds the writing that spans files, listed in [docs/README.md](docs/README.md): [design](docs/design.md) (the spec), [usage](docs/usage.md), [sitez](docs/sitez.md) and [elementz](docs/elementz.md) (how it's built, and what was ruled out), [plan](docs/plan.md) (the order of the work), [lessons](docs/lessons.md) and [development](docs/development.md). Pagez's design is in [its repository](https://github.com/amitkaps/pagez/blob/main/docs/design.md). Reference a section by file and heading (`docs/design.md#the-rules`). Rules are the one exception, cited by number (rule 6), since design.md numbers them.
- Work that belongs to one file goes in as a pending `@prose` chunk there, not as a line in the plan.
- Tests carry file prose too: what the file covers, in a line or two.
- Run `pnpm check` and `pnpm test` before opening a pull request.
