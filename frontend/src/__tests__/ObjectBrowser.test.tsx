import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {MantineProvider} from '@mantine/core';
import {Notifications} from '@mantine/notifications';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {vi} from 'vitest';
import {ObjectBrowserPage} from '../pages/ObjectBrowserPage';
import type {S3Object} from '@shared/types';

vi.mock('streamsaver', () => ({
	default: {
		createWriteStream: vi.fn(() => new WritableStream()),
	},
}));

const mockObjects: S3Object[] = [
	{key: 'docs/', size: 0, lastModified: '', isPrefix: true},
	{key: 'readme.txt', size: 1024, lastModified: '2024-01-01T00:00:00.000Z', isPrefix: false},
];

const server = setupServer(
	http.get('/api/buckets/:bucket/objects', () =>
		HttpResponse.json({objects: mockObjects, totalCount: mockObjects.length}),
	),
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
			<Notifications />
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/buckets/:bucket" element={<ObjectBrowserPage />} />
				</Routes>
			</MemoryRouter>
		</MantineProvider>,
	);

describe('ObjectBrowser', () => {
	it('renders table rows for objects returned by the API', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByText('docs/')).toBeInTheDocument();
			expect(screen.getByText('readme.txt')).toBeInTheDocument();
		});
	});

	it('shows loading skeletons while the fetch is in flight', () => {
		renderPage('/buckets/my-bucket');
		const skeletons = document.querySelectorAll('.mantine-Skeleton-root');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it('folder click updates the URL prefix and re-fetches', async () => {
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('docs/'));

		let capturedUrl = '';
		server.use(
			http.get('/api/buckets/:bucket/objects', ({request}) => {
				capturedUrl = request.url;
				return HttpResponse.json({objects: [], totalCount: 0});
			}),
		);

		await user.click(screen.getByRole('button', {name: /open folder docs\//i}));
		await waitFor(() => {
			expect(capturedUrl).toContain('prefix=docs%2F');
		});
	});

	it('clicking a file row sets the key search param', async () => {
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('readme.txt'));
		const fileBtn = screen.getByText('readme.txt').closest('button');
		expect(fileBtn).not.toBeNull();
		await user.click(fileBtn!);
		await waitFor(() => {
			expect(screen.getByTestId('path-block')).toBeInTheDocument();
		});
	});

	it('pagination controls call the API with correct offset', async () => {
		let capturedUrl = '';
		server.use(
			http.get('/api/buckets/:bucket/objects', ({request}) => {
				capturedUrl = request.url;
				return HttpResponse.json({objects: mockObjects, totalCount: 250});
			}),
		);
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('readme.txt'));
		const nextBtn = screen.getByRole('button', {name: /next page/i});
		await user.click(nextBtn);
		await waitFor(() => {
			expect(capturedUrl).toContain('offset=100');
		});
	});

	it('empty state renders when server returns zero objects', async () => {
		server.use(
			http.get('/api/buckets/:bucket/objects', () =>
				HttpResponse.json({objects: [], totalCount: 0}),
			),
		);
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByText(/this folder is empty/i)).toBeInTheDocument();
		});
	});

	it('shows error toast on fetch failure', async () => {
		server.use(
			http.get('/api/buckets/:bucket/objects', () => new HttpResponse(null, {status: 500})),
		);
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByText(/failed to load objects/i)).toBeInTheDocument();
		});
	});

	it('gallery toggle switches to gallery view', async () => {
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('readme.txt'));
		await user.click(screen.getByRole('button', {name: /gallery view/i}));
		await waitFor(() => {
			expect(screen.queryByRole('columnheader', {name: /name/i})).not.toBeInTheDocument();
		});
	});

	it('filter input narrows visible rows', async () => {
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('readme.txt'));
		await user.type(screen.getByPlaceholderText('Filter visible'), 'docs');
		await waitFor(() => {
			expect(screen.queryByText('readme.txt')).not.toBeInTheDocument();
			expect(screen.getByText('docs/')).toBeInTheDocument();
		});
	});

	it('download folder button appears when inside a prefix', async () => {
		renderPage('/buckets/my-bucket?prefix=docs%2F');
		await waitFor(() => {
			expect(
				screen.getByRole('button', {name: /download folder docs\//i}),
			).toBeInTheDocument();
		});
	});

	it('delete folder confirmation appears and fires DELETE on confirm', async () => {
		let deleteCalled = false;
		server.use(
			http.delete('/api/buckets/:bucket/folder', () => {
				deleteCalled = true;
				return HttpResponse.json({ok: true});
			}),
		);
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket?prefix=docs%2F');
		await waitFor(() => {
			expect(screen.getByRole('button', {name: /delete folder docs\//i})).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /delete folder docs\//i}));
		await waitFor(() => {
			expect(screen.getByRole('button', {name: /^delete$/i})).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /^delete$/i}));
		await waitFor(() => {
			expect(deleteCalled).toBe(true);
		});
	});

	it('drag overlay is absent under normal conditions', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('readme.txt'));
		expect(screen.queryByLabelText('Drop to upload')).not.toBeInTheDocument();
	});

	it('drag overlay appears when dragging over the browser container', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('readme.txt'));
		const container = screen.getByTestId('object-browser');
		fireEvent.dragEnter(container);
		await waitFor(() => {
			expect(screen.getByLabelText('Drop to upload')).toBeInTheDocument();
		});
	});

	it('drag overlay disappears when dragging out of the browser container', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('readme.txt'));
		const container = screen.getByTestId('object-browser');
		fireEvent.dragEnter(container);
		await waitFor(() => {
			expect(screen.getByLabelText('Drop to upload')).toBeInTheDocument();
		});
		fireEvent.dragLeave(container);
		await waitFor(() => {
			expect(screen.queryByLabelText('Drop to upload')).not.toBeInTheDocument();
		});
	});

	it('calculate size button appears for folders and shows size after fetch', async () => {
		server.use(
			http.get('/api/buckets/:bucket/folder-size', () => HttpResponse.json({size: 512})),
		);
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('docs/'));

		const calcBtn = screen.getByRole('button', {name: /calculate size of docs\//i});
		await user.click(calcBtn);

		await waitFor(() => {
			expect(screen.getByText('512 B')).toBeInTheDocument();
		});
	});
});
