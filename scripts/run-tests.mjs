import { spawnSync } from 'node:child_process';
import { globSync } from 'glob';

const testFiles = globSync('tests/**/*.test.ts', {
	cwd: process.cwd(),
	nodir: true,
	posix: true,
}).sort();

if (testFiles.length === 0) {
	console.error('No test files matched tests/**/*.test.ts');
	process.exit(1);
}

const result = spawnSync(
	process.execPath,
	['--import', 'tsx', '--test', ...testFiles],
	{ stdio: 'inherit' },
);

if (result.error) {
	throw result.error;
}

process.exit(result.status ?? 1);
