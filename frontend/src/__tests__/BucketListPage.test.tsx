import {render, screen, waitFor} from '@testing-library/react';
import {BrowserRouter} from 'react-router-dom';
import {MantineProvider} from '@mantine/core';
import {Notifications} from '@mantine/notifications';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {BucketListPage} from '../pages/BucketListPage';
import type {Bucket, BucketStats} from '@shared/types';

const mockBuckets: Bucket[] = [
	{name: 'my-bucket', creationDate: '2024-01-01T00:00:00.000Z', region: 'us-east-1'},
	{name: 'another-bucket', creationDate: '2024-02-01T00:00:00.000Z', region: 'eu-west-1'},
];

const mockStats: BucketStats = {objectCount: 42, totalSize: 1024 * 1024};

const server = setupServer(
	http.get('/api/buckets', () => HttpResponse.json({buckets: mockBuckets})),
	http.get('/api/buckets/:bucket/stats', () => HttpResponse.json(mockStats)),
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
			<Notifications />
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

	it('renders region badges', async () => {
		renderPage();
		await waitFor(() => {
			expect(screen.getByText('us-east-1')).toBeInTheDocument();
			expect(screen.getByText('eu-west-1')).toBeInTheDocument();
		});
	});

	it('renders creation dates', async () => {
		renderPage();
		await waitFor(() => {
			const dateTexts = screen.getAllByText(/Created/);
			expect(dateTexts.length).toBeGreaterThanOrEqual(2);
		});
	});

	it('renders async stats after loading', async () => {
		renderPage();
		await waitFor(() => {
			const objectTexts = screen.getAllByText('42 objects');
			expect(objectTexts.length).toBe(2);
		});
	});

	it('shows error fallback when stats fetch fails', async () => {
		server.use(
			http.get('/api/buckets/:bucket/stats', () => new HttpResponse(null, {status: 500})),
		);
		renderPage();
		await waitFor(() => {
			const unavailable = screen.getAllByText('unavailable');
			expect(unavailable.length).toBe(2);
		});
	});

	it('shows error toast on buckets fetch failure', async () => {
		server.use(http.get('/api/buckets', () => new HttpResponse(null, {status: 500})));
		renderPage();
		await waitFor(() => {
			expect(screen.getByText('Failed to load buckets')).toBeInTheDocument();
		});
	});
});
