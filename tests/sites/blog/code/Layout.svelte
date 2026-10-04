<script>
	let { site, children } = $props();
</script>

<header>
	<a href="/">{site.name}</a>
	<nav><a href="/blog/">Blog</a> <a href="/about/">About</a></nav>
</header>

<main>
	{@render children()}
</main>
