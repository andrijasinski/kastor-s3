import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MantineProvider} from '@mantine/core';
import {vi, describe, it, expect} from 'vitest';
import {PaginationControls} from '../components/Pagination';

const renderPagination = (props: Parameters<typeof PaginationControls>[0]) =>
	render(
		<MantineProvider>
			<PaginationControls {...props} />
		</MantineProvider>,
	);

describe('PaginationControls', () => {
	it('renders nothing when totalCount is 0', () => {
		renderPagination({
			page: 1,
			totalCount: 0,
			pageSize: 100,
			onPageChange: vi.fn(),
			onPageSizeChange: vi.fn(),
		});
		expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
		expect(screen.queryByRole('button', {name: /previous page/i})).not.toBeInTheDocument();
	});

	it('shows page X of Y and item range', () => {
		renderPagination({
			page: 2,
			totalCount: 250,
			pageSize: 100,
			onPageChange: vi.fn(),
			onPageSizeChange: vi.fn(),
		});
		expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
		expect(screen.getByText(/101.+200\/250 items/)).toBeInTheDocument();
	});

	it('renders all page numbers when total pages <= 7', () => {
		renderPagination({
			page: 1,
			totalCount: 500,
			pageSize: 100,
			onPageChange: vi.fn(),
			onPageSizeChange: vi.fn(),
		});
		for (let i = 1; i <= 5; i++) {
			expect(screen.getByRole('button', {name: `Page ${i}`})).toBeInTheDocument();
		}
	});

	it('renders ellipsis for large page ranges', () => {
		renderPagination({
			page: 5,
			totalCount: 1000,
			pageSize: 100,
			onPageChange: vi.fn(),
			onPageSizeChange: vi.fn(),
		});
		expect(screen.getByRole('button', {name: 'Page 1'})).toBeInTheDocument();
		expect(screen.getByRole('button', {name: 'Page 10'})).toBeInTheDocument();
		const ellipses = screen.getAllByText('…');
		expect(ellipses.length).toBeGreaterThanOrEqual(2);
	});

	it('highlights current page button', () => {
		renderPagination({
			page: 3,
			totalCount: 500,
			pageSize: 100,
			onPageChange: vi.fn(),
			onPageSizeChange: vi.fn(),
		});
		const currentBtn = screen.getByRole('button', {name: 'Page 3'});
		expect(currentBtn).toHaveAttribute('aria-current', 'page');
	});

	it('calls onPageChange with correct page when clicking a page number', async () => {
		const onPageChange = vi.fn();
		const user = userEvent.setup();
		renderPagination({
			page: 1,
			totalCount: 500,
			pageSize: 100,
			onPageChange,
			onPageSizeChange: vi.fn(),
		});
		await user.click(screen.getByRole('button', {name: 'Page 3'}));
		expect(onPageChange).toHaveBeenCalledWith(3);
	});

	it('calls onPageChange with page+1 when clicking next', async () => {
		const onPageChange = vi.fn();
		const user = userEvent.setup();
		renderPagination({
			page: 2,
			totalCount: 500,
			pageSize: 100,
			onPageChange,
			onPageSizeChange: vi.fn(),
		});
		await user.click(screen.getByRole('button', {name: /next page/i}));
		expect(onPageChange).toHaveBeenCalledWith(3);
	});

	it('calls onPageChange with page-1 when clicking prev', async () => {
		const onPageChange = vi.fn();
		const user = userEvent.setup();
		renderPagination({
			page: 3,
			totalCount: 500,
			pageSize: 100,
			onPageChange,
			onPageSizeChange: vi.fn(),
		});
		await user.click(screen.getByRole('button', {name: /previous page/i}));
		expect(onPageChange).toHaveBeenCalledWith(2);
	});

	it('disables prev button on first page', () => {
		renderPagination({
			page: 1,
			totalCount: 200,
			pageSize: 100,
			onPageChange: vi.fn(),
			onPageSizeChange: vi.fn(),
		});
		expect(screen.getByRole('button', {name: /previous page/i})).toBeDisabled();
	});

	it('disables next button on last page', () => {
		renderPagination({
			page: 2,
			totalCount: 200,
			pageSize: 100,
			onPageChange: vi.fn(),
			onPageSizeChange: vi.fn(),
		});
		expect(screen.getByRole('button', {name: /next page/i})).toBeDisabled();
	});

	it('calls onPageSizeChange when selecting a different page size', async () => {
		const onPageSizeChange = vi.fn();
		const user = userEvent.setup();
		renderPagination({
			page: 1,
			totalCount: 200,
			pageSize: 100,
			onPageChange: vi.fn(),
			onPageSizeChange,
		});
		await user.click(screen.getByRole('textbox', {name: /page size/i}));
		await user.click(screen.getByRole('option', {name: /50/}));
		expect(onPageSizeChange).toHaveBeenCalledWith(50);
	});
});
