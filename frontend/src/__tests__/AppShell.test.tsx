import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {MantineProvider} from '@mantine/core';
import {Notifications} from '@mantine/notifications';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {BucketsProvider} from '../contexts/BucketsContext';
import {AppShell} from '../components/AppShell';
import type {Bucket, BucketStats} from '@shared/types';

const mockBuckets: Bucket[] = [
	{name: 'my-bucket', creationDate: '2024-01-01T00:00:00.000Z', region: 'us-east-1'},
	{name: 'another-bucket', creationDate: '2024-02-01T00:00:00.000Z', region: 'eu-west-1'},
];

const mockStats: BucketStats = {objectCount: 5, totalSize: 1024};

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

const renderShell = (path: string) =>
	render(
		<MantineProvider>
			<Notifications />
			<MemoryRouter initialEntries={[path]}>
				<BucketsProvider>
					<AppShell>
						<Routes>
							<Route path="/" element={<div>Buckets page</div>} />
							<Route path="/buckets/:bucket" element={<div>Browser page</div>} />
						</Routes>
					</AppShell>
				</BucketsProvider>
			</MemoryRouter>
		</MantineProvider>,
	);

describe('AppShell', () => {
	it('populates the bucket list from /api/buckets', async () => {
		renderShell('/');
		await waitFor(() => {
			expect(screen.getByText('my-bucket')).toBeInTheDocument();
			expect(screen.getByText('another-bucket')).toBeInTheDocument();
		});
	});

	it('marks the active bucket with aria-current', async () => {
		renderShell('/buckets/my-bucket');
		await waitFor(() => {
			const btn = screen.getByRole('button', {name: /go to bucket my-bucket/i});
			expect(btn).toHaveAttribute('aria-current', 'page');
		});
	});

	it('does not mark the inactive bucket', async () => {
		renderShell('/buckets/my-bucket');
		await waitFor(() => {
			const btn = screen.getByRole('button', {name: /go to bucket another-bucket/i});
			expect(btn).not.toHaveAttribute('aria-current', 'page');
		});
	});

	it('shows the kastor wordmark', async () => {
		renderShell('/');
		expect(screen.getByText('kastor')).toBeInTheDocument();
	});

	it('clicking a bucket in the rail navigates to it', async () => {
		const user = userEvent.setup();
		renderShell('/');
		await waitFor(() => {
			expect(screen.getByText('my-bucket')).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /go to bucket my-bucket/i}));
		await waitFor(() => {
			expect(screen.getByText('Browser page')).toBeInTheDocument();
		});
	});

	it('shows storage aggregate once stats are loaded', async () => {
		renderShell('/');
		await waitFor(() => {
			expect(screen.getByText('Storage', {exact: false})).toBeInTheDocument();
		});
	});

	it('shows storage section', async () => {
		renderShell('/');
		expect(screen.getByText('Storage', {exact: false})).toBeInTheDocument();
	});
});
