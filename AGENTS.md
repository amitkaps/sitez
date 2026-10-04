# Working on this repo

How to work in Sitez: what to read first, the rules the project holds, and the prose rules it
follows.

Read **`docs/idea.md`** and **`docs/design.md`** first. They say what Sitez promises and how it
is built. **`docs/plan.md`** is the order the work happens in.

- `idea.md` is the spec. Its promises and rules are what users rely on, and `design.md` can
  change underneath them. A change that breaks a promise, or builds something listed in "Not in
  v1", is the human's decision. Say so instead of building it.
- Sitez has no configuration. When a feature seems to need an option, look for the convention
  that makes it unnecessary, or ask. `site.md` holds metadata, never settings.
- Every failure a user can cause (a broken link, a function in a build-time template, a reserved
  file name) fails the build. Its message names the file and what to change. Never guess silently.

## Reading the codebase

Read the map before the code. The prose is kept current with the code, so its first paragraphs
tell you what each part means without loading it.

1. `docs/*.md` for the design across the codebase.
2. A folder's `README.md` for what the folder holds.
3. The first paragraph of each file's `@prose` block (`grep -rn -A4 "@prose" src`) to find the
   file that matters.
4. The code itself only for the chunks you will change.

If the prose you read turns out to be wrong about the code, fixing it is part of the change.

## Prose

The rules from [`@amitkaps/prose`](https://github.com/amitkaps/prose/blob/main/docs/usage.md#for-agents),
copied as they are. `pnpm prose` reads the result as a document.

- Every source file opens with a `@prose` comment, its summary. Add more wherever the reader needs the why, like a design choice or an edge that's easy to get wrong. Trivial declarations, types, constants and mechanical helpers don't need one. A paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`, except `.github/`, where GitHub would show it in place of the root's.
- Every prose comment, README and doc begins with a short first paragraph, its summary for the human, in about three lines. It says what the file or section means, not what its code does. Detail goes below it. When a change alters a file's role, rewrite that paragraph in the same change.
- Write plain sentences. Each one holds one idea, in about 25 words at most, in the active voice with a named subject. If a point doesn't fit, give it its own sentence or cut it. Don't join ideas with semicolons or colons, and keep parentheses for links and examples. Use one term for each concept, the one the docs already use.
- Prose goes in `@prose` comments, written in [markz's Markdown](https://markz.amitkaps.com/docs/syntax.md). Write `_emphasis_`, never `*emphasis*`, and no raw HTML. Ordinary comments stay for code-level notes.
- Prose says what the code can't. That's why it exists, what it promises, what was decided and what was ruled out. It doesn't retell what reading the code shows, and it doesn't replace ordinary comments.
- A library ships the comment above each export in its types, as that export's documentation. So give every export a comment, and a one-line JSDoc is enough. Put a section's prose above the declaration it describes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted, and don't append. A change that only tunes code, with the same behaviour and the same stated costs, needn't touch prose.
- State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change. One that spans files goes into the doc it changes, and one about a single spot goes into the `@prose` there. Write docs for a reader who wasn't in the chat, since they may be published as they are. When something is ruled out, write down that it's out and why, so it isn't rebuilt.
- If the project keeps a plan, keep it current, with what's done in one line each and what's next in order.
- To find your way, `grep -rn -A4 "@prose" src` is the map, and `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet. Add an `--include` for each other language the project writes.

For this repository that means:

- `docs/` holds the writing that spans files: [idea](docs/idea.md) (the spec), [design](docs/design.md) (how it's built, and what was ruled out) and [plan](docs/plan.md) (the order of the work). Reference a section by file and heading (`docs/idea.md#the-rules`). Rules are the one exception, cited by number (rule 6), since idea.md numbers them.
- Work that belongs to one file goes in as a pending `@prose` chunk there, not as a line in the plan.
- Tests carry file prose too: what the file covers, in a line or two.
- Commit and push to `main`. Run `pnpm check` and `pnpm test` first.
