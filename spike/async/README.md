# Async server rendering

**Answer: it holds.** With `experimental: { async: true }` at compile time, `await render(...)`
returns the complete page, and rule 5 stands as written.

- A page's top-level `await`, a child component's own `await`, and `await` inside the template
  all resolve before the HTML is returned. Independent awaits in different components run in
  parallel (the page took 157 ms for a 100 ms and a 50 ms wait on the page and a 100 ms one in a
  child).
- Reading `body` without awaiting throws `await_invalid`, so a forgotten `await` can't ship half
  a page.
- A rejected promise rejects the render with the original error. The stack names the data module,
  not the component, so Sitez wraps each page's render and names the page file itself.
- 50 pages rendered concurrently in the time of one: a build can render pages in parallel.
- The body carries Svelte's hydration comments (`<!--[-->`, `<!--]-->`) everywhere, not only in
  islands. They cost bytes on static pages; stripping them outside islands is a step 7 decision,
  measured by the build report.
