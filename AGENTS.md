# Working on this repo

Read **`prose/idea.md`** and **`prose/design.md`** first: what Sitez promises, and how it is built.
**`prose/plan.md`** is the order the work happens in.

- `idea.md` is the spec. Its promises and rules are what users rely on; `design.md` can change
  underneath them. A change that breaks a promise, or builds something listed in "Not in v1",
  is the human's decision: say so instead of building it.
- Sitez has no configuration. When a feature seems to need an option, look for the convention
  that makes it unnecessary, or ask. `site.md` holds metadata, never settings.
- Every failure a user can cause (a broken link, a function passed to an island, a reserved file
  name) fails the build with a message naming the file and what to change. Never guess silently.

## Reading the codebase

Read the map before the code. The prose is kept current with the code, so its first paragraphs
tell you what each part means without loading it:

1. `prose/*.md` for the design across the codebase.
2. A folder's `README.md` for what the folder holds.
3. The first paragraph of each file's `@prose` block (`grep -rn -A4 "@prose" src`) to find the
   file that matters.
4. The code itself only for the chunks you will change.

If the prose you read turns out to be wrong about the code, fixing it is part of the change.

## Prose (`@amitkaps/prose`, `pnpm prose`)

- Every file has file prose, and every meaningful unit of it is in a chunk with prose. Trivial declarations, types, constants and mechanical helpers don't need a chunk of their own unless they carry architectural intent; a paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`, except `.github/`, where GitHub would show it in place of the root's.
- Every prose block, file, folder and `prose/` doc begins with a short first paragraph that is its summary for the human: about three lines, one idea per sentence. It says what the node means, not what its code does; detail goes in the chunks below. When a change alters a node's role, intent or place in the design, rewrite that paragraph in the same change.
- Prose goes in `@prose` comments, in markz's Markdown. Ordinary comments stay for code-level notes.
- Prose says what the code can't: why it exists, what it promises, what was decided and what was ruled out. It doesn't retell what reading the code shows, and it doesn't replace ordinary comments.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append. A change that only tunes code (same behaviour, same stated costs) needn't touch prose.
- State a rule once. If a doc or a tested file owns it, link to it by repo path and keep only how and why this code does it.
- Decisions made in the chat go into the prose in the same change: into the doc they change when they span files, into the `@prose` block when they concern one spot. Write docs for a reader who wasn't in the chat, since they may be published as they are.
- Keep `prose/plan.md` current: what's done in one line each, what's next in order. Fill pending chunks as plan items. Work that belongs to one file goes in as a pending chunk there, not in a list elsewhere.
- When unsure, or when a decision is the human's, ask instead of guessing.
- To find your way: `grep -rn -A4 "@prose" src` is the map; `grep -rL "@prose" src --include="*.ts"` lists files with no prose yet. `pnpm prose` reads the result as a document.
