const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);

export function isImageFile(key: string): boolean {
	const ext = key.split('.').pop()?.toLowerCase() ?? '';
	return IMAGE_EXTENSIONS.has(ext);
}
