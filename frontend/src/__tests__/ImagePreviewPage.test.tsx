import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {MantineProvider} from '@mantine/core';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {ImagePreviewPage} from '../pages/ImagePreviewPage';
import type {S3Object} from '@shared/types';

const siblings: S3Object[] = [
	{
		key: 'photos/beach.jpg',
		size: 204800,
		lastModified: '2024-06-01T12:00:00.000Z',
		isPrefix: false,
	},
	{
		key: 'photos/report.pdf',
		size: 51200,
		lastModified: '2024-06-02T09:00:00.000Z',
		isPrefix: false,
	},
];

const server = setupServer(
	http.get('/api/buckets/:bucket/object', () => new HttpResponse(new Uint8Array([1, 2, 3]))),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderPage = (key: string, state?: {siblings: S3Object[]}) =>
	render(
		<MantineProvider>
			<MemoryRouter
				initialEntries={[
					{
						pathname: '/buckets/my-bucket/preview',
						search: `?key=${encodeURIComponent(key)}`,
						state,
					},
				]}
			>
				<Routes>
					<Route path="/buckets/:bucket/preview" element={<ImagePreviewPage />} />
				</Routes>
			</MemoryRouter>
		</MantineProvider>,
	);

describe('ImagePreviewPage', () => {
	it('renders an img tag for an image file', async () => {
		renderPage('photos/beach.jpg', {siblings});
		const img = screen.getByRole('img');
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute('src', '/api/buckets/my-bucket/object?key=photos%2Fbeach.jpg');
	});

	it('renders "No preview available" for a non-image file', async () => {
		renderPage('photos/report.pdf', {siblings});
		await waitFor(() => {
			expect(screen.getByText(/no preview available/i)).toBeInTheDocument();
		});
	});

	it('does not render an img tag for a non-image file', async () => {
		renderPage('photos/report.pdf', {siblings});
		await waitFor(() => {
			expect(screen.queryByRole('img')).not.toBeInTheDocument();
		});
	});

	it('renders breadcrumbs including the filename', async () => {
		renderPage('photos/beach.jpg', {siblings});
		await waitFor(() => {
			expect(screen.getByText('my-bucket')).toBeInTheDocument();
			expect(screen.getByText('photos')).toBeInTheDocument();
			expect(screen.getByText('beach.jpg')).toBeInTheDocument();
		});
	});

	it('shows file size from router state', async () => {
		renderPage('photos/beach.jpg', {siblings});
		await waitFor(() => {
			expect(screen.getByText('200.0 KB')).toBeInTheDocument();
		});
	});

	it('shows last modified from router state', async () => {
		renderPage('photos/beach.jpg', {siblings});
		await waitFor(() => {
			expect(screen.getByText(/2024/)).toBeInTheDocument();
		});
	});

	it('disables Prev button when on the first file', () => {
		renderPage('photos/beach.jpg', {siblings});
		expect(screen.getByRole('button', {name: /prev/i})).toBeDisabled();
	});

	it('disables Next button when on the last file', () => {
		renderPage('photos/report.pdf', {siblings});
		expect(screen.getByRole('button', {name: /next/i})).toBeDisabled();
	});

	it('disables both buttons when no sibling list in router state', () => {
		renderPage('photos/beach.jpg');
		expect(screen.getByRole('button', {name: /prev/i})).toBeDisabled();
		expect(screen.getByRole('button', {name: /next/i})).toBeDisabled();
	});

	it('clicking Next navigates to the next file', async () => {
		const user = userEvent.setup();
		renderPage('photos/beach.jpg', {siblings});
		await user.click(screen.getByRole('button', {name: /next/i}));
		await waitFor(() => {
			expect(screen.getByText('report.pdf')).toBeInTheDocument();
		});
	});

	it('clicking Prev navigates to the previous file', async () => {
		const user = userEvent.setup();
		renderPage('photos/report.pdf', {siblings});
		await user.click(screen.getByRole('button', {name: /prev/i}));
		await waitFor(() => {
			expect(screen.getByText('beach.jpg')).toBeInTheDocument();
		});
	});
});
