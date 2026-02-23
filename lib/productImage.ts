/**
 * True when product has a valid image URL (local path or http(s)).
 * Use to show ProductImagePlaceholder when this returns false.
 */
export function hasProductImage(image: string): boolean {
	const trimmed = image?.trim() ?? '';
	return trimmed.length > 0 && (trimmed.startsWith('/') || trimmed.startsWith('http'));
}
