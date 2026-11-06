import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const host = '127.0.0.1';
const port = Number(process.env.AFFILIATE_PREVIEW_PORT || 3199);
const origin = `http://${host}:${port}`;
const outputDirectoryName = process.env.AFFILIATE_PREVIEW_OUTPUT || 'affiliate-preview-upload';
const outputDirectory = path.resolve(outputDirectoryName);
const publicPath = `/${(process.env.AFFILIATE_PREVIEW_PUBLIC_PATH || outputDirectoryName).replace(/^\/+|\/+$/g, '')}/`;

const waitForPage = async () => {
	let lastError;
	for (let attempt = 0; attempt < 90; attempt += 1) {
		try {
			const response = await fetch(`${origin}/affiliate`);
			if (response.ok) return response;
			lastError = new Error(`Preview server returned ${response.status}`);
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw lastError ?? new Error('Timed out waiting for the affiliate preview page.');
};

const server = spawn(path.resolve('node_modules/.bin/next'), ['dev', '--hostname', host, '--port', String(port)], {
	stdio: ['ignore', 'pipe', 'pipe'],
	env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});

let serverLog = '';
server.stdout.on('data', (chunk) => {
	serverLog += chunk.toString();
});
server.stderr.on('data', (chunk) => {
	serverLog += chunk.toString();
});

try {
	const pageResponse = await waitForPage();
	let html = await pageResponse.text();

	const stylesheetPaths = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"?]+)(?:\?[^" ]*)?"[^>]*>/g)].map((match) => match[1]);
	const publicAssetPaths = [...html.matchAll(/(?:src|href)="(\/(?!_next\/)[^"?#]+)(?:[?#][^"]*)?"/g)]
		.map((match) => match[1])
		.filter((assetPath) => /\.[a-z0-9]{2,5}$/i.test(assetPath));

	html = html
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<link\b[^>]*rel="preload"[^>]*as="script"[^>]*>/gi, '')
		.replace(/(<link[^>]+rel="stylesheet"[^>]+href="[^"?]+)\?[^" ]*(")/gi, '$1$2')
		.replace(/(href|src)="\/(_next\/static\/css\/app\/layout\.css|favicon\.ico|mineral-white-logo\.svg)"/g, (_match, attribute, assetPath) => `${attribute}="${publicPath}${assetPath}"`)
		.replace(/<button type="submit"/g, '<button type="button" aria-disabled="true" title="Preview only — submissions are disabled"')
		.replace(/<!--\$-->|<!--\/\$-->/g, '')
		.replace('<head>', '<head>\n<!-- Static affiliate design preview: application submission is intentionally disabled. -->');

	await rm(outputDirectory, { recursive: true, force: true });
	await mkdir(outputDirectory, { recursive: true });
	await writeFile(path.join(outputDirectory, 'index.html'), html);

	for (const assetPath of new Set([...stylesheetPaths, ...publicAssetPaths])) {
		const response = await fetch(`${origin}${assetPath}`);
		if (!response.ok) throw new Error(`Could not export ${assetPath}: ${response.status}`);
		const destination = path.join(outputDirectory, assetPath.replace(/^\//, ''));
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, Buffer.from(await response.arrayBuffer()));
	}

	console.log(`Affiliate preview exported to ${outputDirectory}`);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	if (serverLog.trim()) console.error(serverLog.trim());
	process.exitCode = 1;
} finally {
	server.kill('SIGTERM');
}
