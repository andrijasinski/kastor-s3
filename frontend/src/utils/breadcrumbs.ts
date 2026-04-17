export interface BreadcrumbSegment {
	label: string;
	prefix: string | null;
}

export const buildBreadcrumbSegments = (path: string): BreadcrumbSegment[] => {
	const parts = path.split('/').filter((p) => p.length > 0);
	return parts.map((part, i) => ({
		label: part,
		prefix: i < parts.length - 1 ? `${parts.slice(0, i + 1).join('/')}/` : null,
	}));
};
