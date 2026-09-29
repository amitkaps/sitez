# Islands from the compiler

**Answer: read the compiler's AST (`parse(source, { modern: true })`), not the compiled output.**
Both find what a component does to its own elements, but only the AST sees a handler passed to a
child, which rule 6 needs. `design.md` said "compiled output"; it should say the AST.

| component                                                   | compiled client code              | AST                                                        |
| ----------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| event attribute                                             | `$.delegate`, `$.event`           | `Attribute` named `on…`, expression value                  |
| `bind:`                                                     | `$.bind_value`, `$.bind_window_*` | `BindDirective`                                            |
| transition                                                  | `$.transition`                    | `TransitionDirective`                                      |
| animate                                                     | `$.animation`                     | `AnimateDirective`                                         |
| `{@attach}`                                                 | `$.attach`                        | `AttachTag`                                                |
| `use:` action                                               | `$.action`                        | `UseDirective`                                             |
| `$effect`                                                   | `$.user_effect`                   | call to `$effect` / `$effect.pre`                          |
| `onMount`                                                   | `onMount`                         | call to `onMount`                                          |
| `on…` prop to a child                                       | nothing                           | `Attribute` named `on…` on a `Component`, expression value |
| static, `$state` or `$derived` only, `<details>`, `popover` | nothing                           | nothing                                                    |

What it settles:

- **`use:` actions are browser behavior too.** Rule 6's list should name them, or say "an action
  or attachment".
- **A forwarding component isn't an island.** `Button` with `<button {...rest}>` has no behavior
  of its own. The component that passes it `onclick={…}` is the island, which is where the function
  lives. So design.md's line that "a component that forwards `onclick` counts as interactive
  wherever it's used" is wrong, and the better outcome: `Button` used with only data stays HTML.
- **String handlers can't happen.** Svelte rejects `onclick="…"` at compile time.
- **`onboarding="yes"` is data.** Only an `on…` attribute with an expression value counts; a
  string never does.

What the AST misses, and the answer for each:

- **A handler inside a spread to a component** (`<Button {...props}>` where `props.onclick` is a
  function). Nothing static can see it. Sitez controls the server build, so it can check at render
  time: a component that isn't an island and receives an `on…` function prop fails the build,
  naming it and the prop. It is the same check as rule 6's "passing a function fails",
  applied to every component rather than only islands.
- **Effects in `.svelte.ts` modules.** A component calling `useClock()` from a module with an
  `$effect` shows nothing in its own AST. Sitez follows imports of `.svelte.js`/`.svelte.ts`
  modules and scans them for `$effect` and `onMount` the same way.
- **Renamed imports** (`import { onMount as ready }`). Resolve `onMount` through the imports from
  `svelte`, not by name.
- **`{@attach}` and actions that do nothing browser-side** (only read the node) still count. That
  is the rule working as stated, not a miss.
