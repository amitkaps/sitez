/** @prose
 * # Where a page goes in its frame
 *
 * The page goes where the frame keeps its place, exactly as it was rendered.
 */
import { expect, test } from "vite-plus/test";
import { SLOT } from "./head.ts";
import { inFrame } from "./render.ts";

test("the page goes where the frame keeps its place, as it is", () => {
  expect(inFrame(`<main>${SLOT}</main>`, "<h1>$&</h1>")).toBe("<main><h1>$&</h1></main>");
});
