import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { BucketListPage } from '../pages/BucketListPage';
import type { Bucket } from '@shared/types';

const mockBuckets: Bucket[] = [
	{ name: 'my-bucket', creationDate: '2024-01-01T00:00:00.000Z' },
	{ name: 'another-bucket', creationDate: '2024-02-01T00:00:00.000Z' },
];

const server = setupServer(
	http.get('/api/buckets', () => HttpResponse.json({ buckets: mockBuckets })),
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

const renderPage = () =>
	render(
		<MantineProvider>
			<BrowserRouter>
				<BucketListPage />
			</BrowserRouter>
		</MantineProvider>,
	);

describe('BucketListPage', () => {
	it('renders bucket names', async () => {
		renderPage();
		await waitFor(() => {
			expect(screen.getByText('my-bucket')).toBeInTheDocument();
			expect(screen.getByText('another-bucket')).toBeInTheDocument();
		});
	});

	it('shows error on fetch failure', async () => {
		server.use(http.get('/api/buckets', () => new HttpResponse(null, { status: 500 })));
		renderPage();
		await waitFor(() => {
			expect(screen.getByText(/Failed to fetch buckets/i)).toBeInTheDocument();
		});
	});
});
