# Working on this repo

Read **`prose/idea.md`** and **`prose/design.md`** first: what Sitez promises, and how it is built.

- `idea.md` is the spec. Its promises and rules are what users rely on; `design.md` can change
  underneath them. A change that breaks a promise, or builds something listed in "Not in v1",
  is the human's decision: leave a `@note` instead of building it.
- Sitez has no configuration. When a feature seems to need an option, look for the convention
  that makes it unnecessary, or leave a `@note`. `site.md` holds metadata, never settings.
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

## Prose (`@amitkaps/prose`, `/__prose/`)

- Every file has file prose, and every meaningful unit of it is in a chunk with prose. Trivial declarations, types, constants and mechanical helpers don't need a chunk of their own unless they carry architectural intent; a paragraph written only to satisfy this rule is noise the human has to read. Folders have a `README.md`.
- Every prose block, file, folder and `prose/` doc begins with a short first paragraph that is its summary for the human. It says what the node means, not what its code does. When a change alters a node's role, intent or place in the design, rewrite that paragraph in the same change.
- Prose goes in `@prose` comments. Ordinary comments stay for code-level notes.
- Keep prose current in the same change as the code. Rewrite it where it has drifted; don't append.
- Fill pending chunks as plan items. Work that belongs to one file goes in as a pending chunk there, not in a list elsewhere.
- When unsure, or when a decision is the human's, leave a `@note` after the relevant `@prose` block instead of guessing.
- When asked to "handle notes": find every `@note` (`grep -rn "@note"`), address the ones you can act on, and delete them — folding anything worth remembering into the `@prose` block each sat next to. Leave the ones waiting on the human, including your own questions.
- Resolve unresolved-symbol warnings before finishing. Treat a possibly-stale warning as a prompt to reread the prose against the code, not as something to clear with a token edit. `/__prose/` surfaces both as you work.
