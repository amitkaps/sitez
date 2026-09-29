# Elements

A Markz element with a component of its name renders it; the rest stay as Markz writes them.

{@call-out type=note title="{not Svelte}"}
Rendered by `pattern/CallOut.svelte`, holding a [term]{@key-word} of its own.
{/call-out}

{@chart-view data=sales.csv /}

Every other page, listed by `pattern/PageList.svelte` from `prose`:

{@page-list /}

A [term]{@key-word} in a paragraph, and `{@call-out}` in code, which stays code.

```=html
<script>console.log('raw HTML, written as it is');</script>
```

The [docs](docs/index.md) have their own call-out. This line has *star emphasis*, so it warns.
