# Hydrating an island with children

**Answer: it works, with no hydration warnings.** `server.ts` and `server-wrapped.ts` render;
`client.ts` hydrates the result in happy-dom and clicks a tab.

- **Children cost no JavaScript.** On the client the children are already in the page, so the
  raw snippet hands back the wrapper element's own `outerHTML`, and hydration reuses the existing
  node instead of replacing it. The prose inside an island is sent once, as HTML.
- **The wrapper is `<sitez-children>`,** one element as `createRawSnippet` requires. It and
  `<sitez-island>` should be `display: contents` in the baseline stylesheet, so neither affects
  layout.
- **Children can be Svelte, not only prose.** `Island.svelte` is what Sitez puts in place of an
  island during the server build: the marker, the devalue'd props, and the component with its
  children rendered as ordinary Svelte inside `<sitez-children>` (`server-wrapped.ts`). Children
  from a pattern (`{#each}` included) hydrate the same as children from prose.
- **Props keep their types.** A `Date` comes back a `Date`; `Map`, `Set`, `URL`, `RegExp`,
  `BigInt` and `undefined` also cross.
- **A function prop fails with its path.** devalue throws `Cannot stringify a function` with
  `error.path` (`.onclick`, `.nested.fmt`), so Sitez catches it and fails the build naming the
  island and the prop: rule 6's check comes free.
- devalue's output goes in an attribute, so Svelte's attribute escaping is enough; nothing
  hand-escaped.
- The `{#if children}` in `Island.svelte` adds a `<!--[0-->` block marker around the component.
  It hydrated fine, but two wrappers (with and without children) keep the island's HTML exactly
  what the component renders.
