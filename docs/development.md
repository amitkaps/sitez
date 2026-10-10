# Development

How Sitez is built and changed. What every repository shares, like the scripts, CI and releases, is in [ship's standard](https://ship.amitkaps.com/docs/standard.md), and isn't repeated here.

## Build and test

```sh
pnpm install
pnpm dev       # vp pack --watch
pnpm verify    # what CI runs
```

Each source file's unit tests sit beside it in `src/`. The tests that build whole sites are in [tests/](../tests/README.md): each example site is built through Vite and compared with its snapshot, or with the error it must fail with. `browser.test.ts` runs the built pages' JavaScript in happy-dom.

## The packed tarball

CI also packs Sitez and installs the tarball into a copy of the blog example, outside the repository, then builds it. That catches a file missing from `files`, or a dependency only this repository has, before a release does.

## Markz

Sitez bundles Markz rather than depending on it, so a site never installs two versions that disagree. A new Markz reaches a site with Sitez's next release.
