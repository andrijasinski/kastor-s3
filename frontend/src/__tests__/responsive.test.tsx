import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {MantineProvider} from '@mantine/core';
import {Notifications} from '@mantine/notifications';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {vi} from 'vitest';
import {BucketsProvider} from '../contexts/BucketsContext';
import {AppShell} from '../components/AppShell';
import {BucketListPage} from '../pages/BucketListPage';
import {ObjectBrowserPage} from '../pages/ObjectBrowserPage';
import type {Bucket, BucketStats, S3Object} from '@shared/types';

vi.mock('streamsaver', () => ({
	default: {
		createWriteStream: vi.fn(() => new WritableStream()),
	},
}));

const mockBuckets: Bucket[] = [
	{name: 'my-bucket', creationDate: '2024-01-01T00:00:00.000Z', region: 'us-east-1'},
	{name: 'another-bucket', creationDate: '2024-02-01T00:00:00.000Z', region: 'eu-west-1'},
];

const mockStats: BucketStats = {objectCount: 5, totalSize: 1024};

const mockObjects: S3Object[] = [
	{key: 'docs/', size: 0, lastModified: '', isPrefix: true},
	{key: 'readme.txt', size: 1024, lastModified: '2024-01-01T00:00:00.000Z', isPrefix: false},
	{key: 'photo.jpg', size: 2048, lastModified: '2024-01-02T00:00:00.000Z', isPrefix: false},
	{key: 'photo2.jpg', size: 3072, lastModified: '2024-01-03T00:00:00.000Z', isPrefix: false},
];

const server = setupServer(
	http.get('/api/buckets', () => HttpResponse.json({buckets: mockBuckets})),
	http.get('/api/buckets/:bucket/stats', () => HttpResponse.json(mockStats)),
	http.get('/api/buckets/:bucket/objects', () =>
		HttpResponse.json({objects: mockObjects, totalCount: mockObjects.length}),
	),
);

beforeAll(() => {
	server.listen();
});
afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});
afterAll(() => {
	server.close();
});

const mockResizeObserver = (width: number) => {
	const callbacks: ResizeObserverCallback[] = [];
	vi.spyOn(globalThis, 'ResizeObserver').mockImplementation((cb: ResizeObserverCallback) => {
		callbacks.push(cb);
		return {
			observe: (target: Element) => {
				cb(
					[
						{
							contentRect: {
								width,
								height: 800,
								top: 0,
								left: 0,
								right: width,
								bottom: 800,
								x: 0,
								y: 0,
								toJSON: () => ({}),
							},
							borderBoxSize: [],
							contentBoxSize: [],
							devicePixelContentBoxSize: [],
							target,
						},
					],
					{} as ResizeObserver,
				);
			},
			unobserve: () => {},
			disconnect: () => {},
		};
	});
};

const renderAtWidth = (path: string, width: number) => {
	mockResizeObserver(width);
	return render(
		<MantineProvider>
			<Notifications />
			<MemoryRouter initialEntries={[path]}>
				<BucketsProvider>
					<AppShell>
						<Routes>
							<Route path="/" element={<BucketListPage />} />
							<Route path="/buckets/:bucket" element={<ObjectBrowserPage />} />
						</Routes>
					</AppShell>
				</BucketsProvider>
			</MemoryRouter>
		</MantineProvider>,
	);
};

describe('AppShell — mobile (390px)', () => {
	it('renders hamburger button on mobile', async () => {
		renderAtWidth('/', 390);
		await waitFor(() => {
			expect(
				screen.getByRole('button', {name: /open navigation drawer/i}),
			).toBeInTheDocument();
		});
	});

	it('clicking hamburger opens the drawer', async () => {
		const user = userEvent.setup();
		renderAtWidth('/', 390);
		await waitFor(() => {
			expect(
				screen.getByRole('button', {name: /open navigation drawer/i}),
			).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /open navigation drawer/i}));
		expect(screen.getByRole('dialog', {name: /navigation drawer/i})).toBeInTheDocument();
	});

	it('clicking close button dismisses the drawer', async () => {
		const user = userEvent.setup();
		renderAtWidth('/', 390);
		await waitFor(() => {
			expect(
				screen.getByRole('button', {name: /open navigation drawer/i}),
			).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /open navigation drawer/i}));
		expect(screen.getByRole('dialog', {name: /navigation drawer/i})).toBeInTheDocument();
		await user.click(screen.getByRole('button', {name: /close drawer/i}));
		expect(screen.queryByRole('dialog', {name: /navigation drawer/i})).not.toBeInTheDocument();
	});

	it('clicking a bucket in the drawer closes the drawer', async () => {
		const user = userEvent.setup();
		renderAtWidth('/', 390);
		await waitFor(() => {
			expect(
				screen.getByRole('button', {name: /open navigation drawer/i}),
			).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /open navigation drawer/i}));
		await waitFor(() => {
			expect(
				screen.getByRole('button', {name: /go to bucket my-bucket/i}),
			).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /go to bucket my-bucket/i}));
		await waitFor(() => {
			expect(
				screen.queryByRole('dialog', {name: /navigation drawer/i}),
			).not.toBeInTheDocument();
		});
	});

	it('does not render the desktop sidebar', () => {
		renderAtWidth('/', 390);
		expect(screen.queryByRole('navigation', {name: /sidebar/i})).not.toBeInTheDocument();
	});
});

describe('AppShell — desktop (1280px)', () => {
	it('does not render hamburger button on desktop', () => {
		renderAtWidth('/', 1280);
		expect(
			screen.queryByRole('button', {name: /open navigation drawer/i}),
		).not.toBeInTheDocument();
	});

	it('renders the desktop sidebar', async () => {
		renderAtWidth('/', 1280);
		await waitFor(() => {
			expect(screen.getByRole('navigation', {name: /sidebar/i})).toBeInTheDocument();
		});
	});
});

describe('BucketListPage — mobile (390px)', () => {
	it('renders mobile storage card', async () => {
		renderAtWidth('/', 390);
		await waitFor(() => {
			expect(screen.getByText(/storage/i)).toBeInTheDocument();
		});
	});

	it('renders bucket rows as mobile list items', async () => {
		renderAtWidth('/', 390);
		await waitFor(() => {
			expect(
				screen.getByRole('button', {name: /open bucket my-bucket/i}),
			).toBeInTheDocument();
			expect(
				screen.getByRole('button', {name: /open bucket another-bucket/i}),
			).toBeInTheDocument();
		});
	});
});

describe('ObjectBrowser — mobile (390px)', () => {
	it('renders back button in mobile header', async () => {
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByRole('button', {name: /go back/i})).toBeInTheDocument();
		});
	});

	it('renders List and Grid view toggle buttons', async () => {
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByRole('button', {name: /list view/i})).toBeInTheDocument();
			expect(screen.getByRole('button', {name: /grid view/i})).toBeInTheDocument();
		});
	});

	it('shows FOLDERS section for folder objects', async () => {
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText(/folders/i)).toBeInTheDocument();
		});
	});

	it('shows FILES section for file objects', async () => {
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText(/files/i)).toBeInTheDocument();
		});
	});

	it('file rows show size on second line', async () => {
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
		expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
	});

	it('mobile file rows have min-height style applied', async () => {
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
		const fileRow = screen
			.getAllByRole('button')
			.find((el) => el.textContent?.includes('readme.txt'));
		expect(fileRow).toBeDefined();
		expect(fileRow?.style.minHeight).toBe('60px');
	});

	it('renders mobile upload button', async () => {
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
		expect(screen.getByRole('button', {name: /upload/i})).toBeInTheDocument();
	});

	it('tapping a file opens the inspector', async () => {
		const user = userEvent.setup();
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
		await user.click(screen.getByText('readme.txt'));
		await waitFor(() => {
			expect(screen.getByRole('button', {name: /back to file list/i})).toBeInTheDocument();
		});
	});
});

describe('ObjectInspector — mobile (390px)', () => {
	it('back button closes the inspector', async () => {
		const user = userEvent.setup();
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
		await user.click(screen.getByText('readme.txt'));
		await waitFor(() => {
			expect(screen.getByRole('button', {name: /back to file list/i})).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /back to file list/i}));
		await waitFor(() => {
			expect(
				screen.queryByRole('button', {name: /back to file list/i}),
			).not.toBeInTheDocument();
		});
	});

	it('peek sheet shows file metadata', async () => {
		const user = userEvent.setup();
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
		await user.click(screen.getByText('readme.txt'));
		await waitFor(() => {
			expect(screen.getByText(/size/i)).toBeInTheDocument();
			expect(screen.getByText(/modified/i)).toBeInTheDocument();
		});
	});

	it('shows download button in mobile action bar', async () => {
		const user = userEvent.setup();
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
		await user.click(screen.getByText('readme.txt'));
		await waitFor(() => {
			expect(screen.getByTestId('download-btn')).toBeInTheDocument();
		});
	});

	it('delete shows confirm step before firing', async () => {
		let deleteCalled = false;
		server.use(
			http.delete('/api/buckets/:bucket/object', () => {
				deleteCalled = true;
				return HttpResponse.json({ok: true});
			}),
		);
		const user = userEvent.setup();
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
		await user.click(screen.getByText('readme.txt'));
		await waitFor(() => {
			expect(screen.getByRole('button', {name: /delete file/i})).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /delete file/i}));
		await waitFor(() => {
			expect(screen.getByRole('button', {name: /^delete$/i})).toBeInTheDocument();
		});
		expect(deleteCalled).toBe(false);
		await user.click(screen.getByRole('button', {name: /^delete$/i}));
		await waitFor(() => {
			expect(deleteCalled).toBe(true);
		});
	});

	it('image inspector renders next button when more siblings exist', async () => {
		const user = userEvent.setup();
		renderAtWidth('/buckets/my-bucket', 390);
		await waitFor(() => {
			expect(screen.getByText('photo.jpg')).toBeInTheDocument();
		});
		await user.click(screen.getByText('photo.jpg'));
		await waitFor(() => {
			expect(screen.getByRole('button', {name: /next image/i})).toBeInTheDocument();
		});
	});
});
