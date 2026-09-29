<script>
  // An island with children: they render inside one <sitez-children> element, which the browser
  // hands back to the component as it is, so they cost no JavaScript.
  import { setContext } from "svelte";
  import Children from "./Children.svelte";
  import { WHERE } from "./server.ts";

  let { component: Component, name, p, props, children } = $props();
  setContext(WHERE, { island: name });
</script>

<sitez-island c={name} {p}
  ><Component {...props}><sitez-children><Children {name} {children} /></sitez-children></Component
  ></sitez-island
>
