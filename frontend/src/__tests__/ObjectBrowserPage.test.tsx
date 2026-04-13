import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ObjectBrowserPage } from '../pages/ObjectBrowserPage';
import type { S3Object } from '@shared/types';

const mockObjects: S3Object[] = [
	{ key: 'docs/', size: 0, lastModified: '', isPrefix: true },
	{ key: 'readme.txt', size: 1024, lastModified: '2024-01-01T00:00:00.000Z', isPrefix: false },
];

const server = setupServer(
	http.get('/api/buckets/:bucket/objects', () => HttpResponse.json({ objects: mockObjects })),
);

beforeAll(() => {
	server.listen();
});
afterEach(() => {
	server.resetHandlers();
});
afterAll(() => {
	server.close();
});

const renderPage = (path: string) =>
	render(
		<MantineProvider>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/buckets/:bucket" element={<ObjectBrowserPage />} />
				</Routes>
			</MemoryRouter>
		</MantineProvider>,
	);

describe('ObjectBrowserPage', () => {
	it('renders objects and prefixes', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByText('docs/')).toBeInTheDocument();
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
	});

	it('shows bucket name in breadcrumb', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByText('my-bucket')).toBeInTheDocument();
		});
	});

	it('navigates into a prefix on click', async () => {
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByText('docs/')).toBeInTheDocument();
		});
		await user.click(screen.getByText('docs/'));
		await waitFor(() => {
			expect(screen.getByText('docs')).toBeInTheDocument();
		});
	});

	it('shows download link for object files', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			const link = screen.getByRole('link', { name: /download readme.txt/i });
			expect(link).toHaveAttribute('href', '/api/buckets/my-bucket/download?key=readme.txt');
		});
	});

	it('shows download button for prefix folders', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /download docs\//i })).toBeInTheDocument();
		});
	});

	it('does not show a link for prefix folder downloads', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(
				screen.queryByRole('link', { name: /download docs\//i }),
			).not.toBeInTheDocument();
		});
	});

	it('shows error on fetch failure', async () => {
		server.use(
			http.get('/api/buckets/:bucket/objects', () => new HttpResponse(null, { status: 500 })),
		);
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByText(/Failed to fetch objects/i)).toBeInTheDocument();
		});
	});
});
