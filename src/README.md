# src

Sitez itself: the `sitez` command and the stages a site goes through on its way to `dist/`. Each
stage gets a file here, or a folder once it needs more than one, as its step in
[plan.md](../prose/plan.md) starts.

- `cli.ts` is the command: it finds the site and runs one of `dev`, `build`, `preview`, `check`
  and `deploy`.
- `root.ts` finds the site from wherever `sitez` runs.
- `errors.ts` is how a mistake in a site becomes a message naming the file and what to change.
