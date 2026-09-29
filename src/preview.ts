/** @prose
 * # Preview
 *
 * `sitez preview`: `dist/` served as a static host serves it, so what works here works deployed.
 * A folder's URL serves its `index.html`, a folder asked for without its slash redirects to it,
 * and anything that isn't there gets `404.html` with a 404 status, as GitHub Pages and Cloudflare
 * do. Nothing is rendered: it's the files `build` wrote, and only them.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, sep } from 'node:path';
import { SiteError } from './errors.ts';

export interface Preview {
	url: string;
	close(): Promise<void>;
}

export async function preview(
	root: string,
	{ port = 4173, outDir = join(root, 'dist') } = {}
): Promise<Preview> {
	if (!existsSync(join(outDir, 'index.html')) && !existsSync(join(outDir, '404.html'))) {
		throw new SiteError(root, "there's no dist/ to preview yet. Run sitez build first.");
	}
	const server = createServer((request, response) => {
		const url = new URL(request.url ?? '/', 'http://localhost');
		const path = pathOf(url);
		const file = join(outDir, path);
		// A path that climbs out of dist/ is nothing a host would serve.
		if (file !== outDir && !file.startsWith(outDir + sep)) return notFound();
		const stat = statSync(file, { throwIfNoEntry: false });
		if (stat?.isDirectory()) {
			if (!path.endsWith('/')) {
				response.writeHead(301, { location: `${url.pathname}/${url.search}` });
				return response.end();
			}
			if (existsSync(join(file, 'index.html'))) return serve(join(file, 'index.html'), 200);
			return notFound();
		}
		if (stat?.isFile()) return serve(file, 200);
		notFound();

		function serve(file: string, status: number) {
			response.writeHead(status, { 'content-type': typeOf(file) });
			response.end(request.method === 'HEAD' ? undefined : readFileSync(file));
		}
		function notFound() {
			const page = join(outDir, '404.html');
			if (existsSync(page)) return serve(page, 404);
			response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
			response.end('Not found');
		}
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, 'localhost', resolve);
	});
	const address = server.address();
	const bound = typeof address === 'object' && address ? address.port : port;
	return {
		url: `http://localhost:${bound}/`,
		close: () => new Promise((resolve) => server.close(() => resolve()))
	};
}

const types: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json',
	'.xml': 'application/xml',
	'.txt': 'text/plain; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.pdf': 'application/pdf',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm'
};

function typeOf(file: string): string {
	return types[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/** A request's path as the files are named, or as sent when it isn't valid percent-encoding. */
export function pathOf(url: URL): string {
	try {
		return decodeURIComponent(url.pathname);
	} catch {
		return url.pathname;
	}
}
