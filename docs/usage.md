# Usage

## Install

A site adds Sitez to its `vite.config.js` and runs [Vite+](https://viteplus.dev)'s commands. Sitez needs Node 26 or newer, the Node it's built and tested on.

```json
{
  "scripts": { "dev": "vp dev", "build": "vp build", "preview": "vp preview" },
  "devDependencies": { "@amitkaps/sitez": "0.4.0", "vite-plus": "^1.1.0" }
}
```

```js
// vite.config.js
import sitez from "@amitkaps/sitez/vite";

export default { plugins: [sitez()] };
```

Sitez takes no options. `vite-plus` is its peer dependency, and a site needs no `vite` and no override.

## Start a site

A site is four folders and three files ([design](design.md#folders)).

- `text/` holds the pages, in Markz. A file's path is its URL, so `text/about.md` is `/about/`.
- `code/` holds what frames, runs and styles them. Every page starts from `code/index.html`, a complete HTML page with one `<slot>`.
- `data/` holds the JSON the code reads, and `public/` the files copied as they are.
- `site.md` holds the site's URL and metadata.

`vp dev` serves it as you write, and `vp build` writes every page as complete HTML. A broken link fails the build, and the build reports what each page costs.

## Add an element

An element is one file in `code/`, `@name.html`, with its markup, its CSS and, when it has behavior, its `setup` ([elementz](elementz.md)). Text writes it as `{@name}`.

## For agents

Give an agent working on a Sitez site these rules.

- Pages are Markz files in `text/`, and a file's path is its URL. There's no route file.
- What a page shows is written where you can see it: the frame in `code/index.html`, a page's heading in its text. Don't expect Sitez to fill in a title or description.
- Link to files, not URLs, so the build can check every link.
- An element is one `code/@name.html` file. Its code imports nothing from the rest of the site.
- Run `vp build` before finishing. It fails on a broken link or a bad element, and says where.
