# Spikes

Throwaway scripts for step 0 of [plan.md](../prose/plan.md): each proves one mechanism the design
rests on, and is deleted once its answer is folded into [design.md](../prose/design.md). Nothing
here is Sitez; nothing imports from here.

- `svelte-hooks.ts` compiles `.svelte` files as Node imports them, for server or browser, so a
  spike can run components without Vite.
- One folder per spike, each with a `run.ts` and a `README.md` holding its answer.

Run one with `node --import ./spike/svelte-hooks.ts spike/<name>/run.ts`.
