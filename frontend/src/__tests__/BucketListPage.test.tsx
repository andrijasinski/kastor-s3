import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {MantineProvider} from '@mantine/core';
import {Notifications} from '@mantine/notifications';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {BucketsProvider} from '../contexts/BucketsContext';
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
			<MemoryRouter initialEntries={['/']}>
				<BucketsProvider>
					<Routes>
						<Route path="/" element={<BucketListPage />} />
						<Route
							path="/buckets/:bucket"
							element={<div data-testid="bucket-page" />}
						/>
					</Routes>
				</BucketsProvider>
			</MemoryRouter>
		</MantineProvider>,
	);

describe('BucketListPage', () => {
	it('renders bucket names in card grid', async () => {
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
			const dateTexts = screen.getAllByText(/created/i);
			expect(dateTexts.length).toBeGreaterThanOrEqual(2);
		});
	});

	it('renders stats (object count and size) once loaded', async () => {
		renderPage();
		await waitFor(() => {
			const objectTexts = screen.getAllByText('42');
			expect(objectTexts.length).toBeGreaterThanOrEqual(2);
		});
	});

	it('shows loading skeleton before stats resolve', () => {
		server.use(
			http.get('/api/buckets/:bucket/stats', async () => {
				await new Promise((r) => setTimeout(r, 500));
				return HttpResponse.json(mockStats);
			}),
		);
		renderPage();
		const skeletons = document.querySelectorAll('.mantine-Skeleton-root');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it('shows empty state when no buckets exist', async () => {
		server.use(http.get('/api/buckets', () => HttpResponse.json({buckets: []})));
		renderPage();
		await waitFor(() => {
			expect(screen.getByText(/no buckets found/i)).toBeInTheDocument();
		});
	});

	it('clicking a card navigates to the bucket', async () => {
		const user = userEvent.setup();
		renderPage();
		await waitFor(() => screen.getByText('my-bucket'));
		await user.click(screen.getByRole('button', {name: /open bucket my-bucket/i}));
		await waitFor(() => {
			expect(screen.getByTestId('bucket-page')).toBeInTheDocument();
		});
	});
});
