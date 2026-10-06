/** @prose
 * # The runtime in a browser
 *
 * `define` in happy-dom: `setup` runs once per connection with a fresh signal, and a disconnect
 * aborts it and calls the cleanup `setup` returned. The source the host writes into its script
 * (`String(define)`) defines elements too.
 */
import { Window } from "happy-dom";
import { afterAll, expect, test } from "vite-plus/test";
import { define, type Setup } from "./runtime.ts";

const window = new Window();
const globals = globalThis as Record<string, unknown>;
const added = ["HTMLElement", "customElements"].filter((key) => !(key in globals));
for (const key of added) globals[key] = (window as unknown as Record<string, unknown>)[key];
afterAll(async () => {
  for (const key of added) delete globals[key];
  await window.happyDOM.close();
});
const { document } = window;
const settled = () => new Promise((done) => setTimeout(done, 0));

test("runs setup per connection, and aborts and cleans up on disconnect", async () => {
  const log: string[] = [];
  const signals: AbortSignal[] = [];
  define("log-box", ((el, { signal }) => {
    signals.push(signal);
    log.push(`setup ${el.id}`);
    return () => log.push("cleanup");
  }) as Setup);
  const el = document.createElement("log-box");
  el.id = "a";
  document.body.append(el);
  await settled();
  el.remove();
  await settled();
  document.body.append(el);
  await settled();
  expect(log).toEqual(["setup a", "cleanup", "setup a"]);
  expect(signals.map((signal) => signal.aborted)).toEqual([true, false]);
});

test("waits for an async setup's cleanup", async () => {
  let cleaned = 0;
  define("lazy-box", (async () => {
    await settled();
    return () => cleaned++;
  }) as Setup);
  const el = document.createElement("lazy-box");
  document.body.append(el);
  el.remove();
  await settled();
  await settled();
  expect(cleaned).toBe(1);
});

test("defines an element from its source, as the site's script holds it", async () => {
  const source = `export default ${String(define)}`;
  const fromSource = (await import(`data:text/javascript,${encodeURIComponent(source)}`))
    .default as typeof define;
  let ran = false;
  fromSource("text-box", () => {
    ran = true;
  });
  document.body.append(document.createElement("text-box"));
  await settled();
  expect(ran).toBe(true);
});
