# tests

Sitez's tests that build whole sites. Each source file's unit tests sit beside it in `src/`.

- `sites/` holds the example sites, one folder each, including the ones that must fail.
- `snapshots/` holds what each site builds to, reviewed as it changes.
- `sites.test.ts` builds every site and compares it with its snapshot or its `error.txt`.
- `live.test.ts` runs the built pages' JavaScript in happy-dom, to show the live elements work.
