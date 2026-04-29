import {ActionIcon, Group, Select, Text} from '@mantine/core';
import {IconChevronLeft, IconChevronRight} from '@tabler/icons-react';

const PAGE_SIZE_OPTIONS = ['50', '100', '200', '300'];

function buildPages(current: number, total: number): (number | '...')[] {
	if (total === 0) {
		return [];
	}
	if (total <= 7) {
		return Array.from({length: total}, (_, i) => i + 1);
	}

	const delta = 2;
	const left = Math.max(2, current - delta);
	const right = Math.min(total - 1, current + delta);

	const pages: (number | '...')[] = [1];
	if (left > 2) {
		pages.push('...');
	}
	for (let i = left; i <= right; i++) {
		pages.push(i);
	}
	if (right < total - 1) {
		pages.push('...');
	}
	pages.push(total);
	return pages;
}

interface PaginationProps {
	page: number;
	totalCount: number;
	pageSize: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
}

export const PaginationControls = ({
	page,
	totalCount,
	pageSize,
	onPageChange,
	onPageSizeChange,
}: PaginationProps) => {
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	if (totalCount === 0) {
		return null;
	}

	const pages = buildPages(page, totalPages);
	const from = (page - 1) * pageSize + 1;
	const to = Math.min(page * pageSize, totalCount);

	return (
		<Group justify="space-between" mt="md" wrap="wrap" gap="xs">
			<Text size="sm" c="dimmed">
				Page {page} of {totalPages} · {from}–{to}/{totalCount} items
			</Text>
			<Group gap="xs">
				<Select
					size="xs"
					value={pageSize.toString()}
					data={PAGE_SIZE_OPTIONS.map((s) => ({value: s, label: `${s} / page`}))}
					onChange={(v) => {
						if (v !== null) {
							onPageSizeChange(parseInt(v, 10));
						}
					}}
					style={{width: 110}}
					styles={{
						dropdown: {
							background: 'var(--bg-surface)',
							border: '1px solid var(--border-strong)',
						},
						option: {
							color: 'var(--text-primary)',
						},
					}}
					aria-label="Page size"
				/>
				<Group gap={4}>
					<ActionIcon
						variant="default"
						size="sm"
						disabled={page === 1}
						onClick={() => {
							onPageChange(page - 1);
						}}
						aria-label="Previous page"
					>
						<IconChevronLeft size={14} />
					</ActionIcon>
					{pages.map((p, i) =>
						p === '...' ? (
							<Text
								key={`ellipsis-${i}`}
								size="sm"
								px={4}
								style={{userSelect: 'none'}}
							>
								…
							</Text>
						) : (
							<ActionIcon
								key={p}
								variant={p === page ? 'filled' : 'default'}
								size="sm"
								onClick={() => {
									onPageChange(p);
								}}
								aria-label={`Page ${p}`}
								aria-current={p === page ? 'page' : undefined}
							>
								{p}
							</ActionIcon>
						),
					)}
					<ActionIcon
						variant="default"
						size="sm"
						disabled={page === totalPages}
						onClick={() => {
							onPageChange(page + 1);
						}}
						aria-label="Next page"
					>
						<IconChevronRight size={14} />
					</ActionIcon>
				</Group>
			</Group>
		</Group>
	);
};
