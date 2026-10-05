# tests

Sitez's tests that build whole sites. Each source file's unit tests sit beside it in `src/`.

- `sites/` holds the example sites, one folder each, including the ones that must fail. Each has a
  `vite.config.js`, which imports `sitez.ts` here in place of `@amitkaps/sitez/vite`.
- `build.ts` builds one of them through Vite, as `vite build` would.
- `snapshots/` holds what each site builds to, reviewed as it changes.
- `sites.test.ts` builds every site and compares it with its snapshot or its `error.txt`.
- `live.test.ts` runs the built pages' JavaScript in happy-dom, to show the live elements work.
