---
title: Elements
---

# Elements

A Markz element with a markup file of its name renders it; the rest stay as Markz writes them.

{@call-out type=note title="{a brace}"}
Rendered by `code/@call-out.html.js`, holding a [term]{@key-word} of its own.
{/call-out}

{@chart-view data=sales.csv /}

The cards in `data/cards.json`, read through a `data` attribute:

{@card-list data="cards.json" .cards /}

{@fold-out label=Details}
Folded text, an element with behavior, its children, with a [term]{@key-word} rendered at build time.
{/fold-out}

Every other page, listed by `code/@page-list.html.js` from `pages`:

{@page-list /}

A [term]{@key-word} in a paragraph, and `{@call-out}` in code, which stays code.

```=html
<script>console.log('raw HTML, written as it is');</script>
```

The [docs](docs/index.md) use the same call-out. This line has *star emphasis*, so it warns.
