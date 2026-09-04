/**
 * Resolves a spreadsheet-provided COA filename against the files deployed in
 * public/coa. Only a plain PDF filename is accepted; paths and partial matches
 * are deliberately rejected.
 */
export function resolveProductCoaFile(configuredFile: string | undefined, availableFiles: readonly string[]): string | null {
	const filename = configuredFile?.trim();
	if (!filename) return null;
	if (filename.includes('/') || filename.includes('\\') || filename.includes('\0')) return null;
	if (!filename.toLowerCase().endsWith('.pdf')) return null;

	return availableFiles.includes(filename) ? filename : null;
}
