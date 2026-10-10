# Lessons

What building Sitez taught, for whoever changes it next. Each lesson says what happened and what to do about it. The detail is in [plan](plan.md), [sitez](sitez.md) and `git log`.

## Size

- **A spike settled the framework.** Svelte's islands loaded 206 KB of JavaScript for amitkaps.github.io's `/teaching/` page, and a spike without it loaded 2 KB. Sitez was rewritten around the spike in 0.2.0. Measure a page before choosing what renders it.
- **Being a Vite plugin cut a site's install.** Dropping the CLI, `check`, `preview` and `deploy` took a site's `node_modules` from 137 MB to 31 MB in 0.3.0. Leave to Vite what Vite already does.
- **One toolchain costs install size.** Moving a site to Vite+ took `node_modules` from 31 MB to 158 MB in 0.4.0. It was taken for one toolchain everywhere, and plain Vite is in [sitez](sitez.md)'s ruled out, with the size it saved.

## Testing

- **Vite loads a config's relative imports again for each build.** The test sites imported the plugin as `../src/plugin.ts`, so each build had its own copy, and a `SiteError` from one failed `instanceof` in another. The sites import it by URL now, which Vite leaves alone, through [tests/sitez.ts](../tests/sitez.ts). Load the code under test once.
- **A real site finds what the examples don't.** Porting Data Portraits' nine charts found an element's error that didn't name its page, and a `url()` in an element's `style` attribute that wasn't checked. Both are in the plan. Port a real site before a release that changes elements.

## Scripts

- **One script per site, like one stylesheet.** Per-page scripts, a common chunk and modulepreload links were replaced by one hashed script, loaded only by a page with an element that has behavior. A library loads with `await import()` inside its element, so nothing else pays for it.
