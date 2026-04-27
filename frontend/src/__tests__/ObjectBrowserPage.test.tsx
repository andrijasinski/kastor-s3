import {render, screen, waitFor} from '@testing-library/react';
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

	it('navigates into a prefix on folder click', async () => {
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('docs/'));
		await user.click(screen.getByRole('button', {name: /open folder docs\//i}));
		await waitFor(() => {
			expect(screen.getByText('docs')).toBeInTheDocument();
		});
	});

	it('clicking a file row opens the inspector (sets key param)', async () => {
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

	it('shows download link for object files', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			const link = screen.getByRole('link', {name: /download readme.txt/i});
			expect(link).toHaveAttribute('href', '/api/buckets/my-bucket/download?key=readme.txt');
		});
	});

	it('shows error on fetch failure', async () => {
		server.use(
			http.get('/api/buckets/:bucket/objects', () => new HttpResponse(null, {status: 500})),
		);
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByText(/failed to load objects/i)).toBeInTheDocument();
		});
	});

	it('shows pagination info when objects are loaded', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => {
			expect(screen.getByText(/Page 1 of 1/i)).toBeInTheDocument();
		});
	});

	it('sends correct offset when page changes', async () => {
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
		await user.click(screen.getByRole('button', {name: /next page/i}));
		await waitFor(() => {
			expect(capturedUrl).toContain('offset=100');
		});
	});

	it('default view is table — gallery tiles not rendered', async () => {
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('readme.txt'));
		expect(screen.getByRole('columnheader', {name: /name/i})).toBeInTheDocument();
	});

	it('toggle to gallery renders gallery tiles and hides table headers', async () => {
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket');
		await waitFor(() => screen.getByText('readme.txt'));
		await user.click(screen.getByRole('button', {name: /gallery view/i}));
		expect(screen.getByRole('button', {name: /open folder docs\//i})).toBeInTheDocument();
		expect(screen.queryByRole('columnheader', {name: /name/i})).not.toBeInTheDocument();
	});

	it('pagination resets to page 1 when navigating to a new prefix', async () => {
		let capturedUrl = '';
		server.use(
			http.get('/api/buckets/:bucket/objects', ({request}) => {
				capturedUrl = request.url;
				return HttpResponse.json({objects: mockObjects, totalCount: mockObjects.length});
			}),
		);
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket?page=3&pageSize=50');
		await waitFor(() => screen.getByText('docs/'));
		await user.click(screen.getByRole('button', {name: /open folder docs\//i}));
		await waitFor(() => {
			expect(capturedUrl).toContain('offset=0');
		});
	});

	it('closes modal and shows orange toast on 207 partial delete failure', async () => {
		server.use(
			http.delete('/api/buckets/:bucket/folder', () =>
				HttpResponse.json(
					{
						error: 'Some objects failed to delete',
						failedKeys: [
							{key: 'docs/a.txt', code: 'AccessDenied', message: 'Access Denied'},
						],
					},
					{status: 207},
				),
			),
		);
		const user = userEvent.setup();
		renderPage('/buckets/my-bucket?prefix=docs%2F');
		await waitFor(() => screen.getByRole('button', {name: /delete folder docs\//i}));
		await user.click(screen.getByRole('button', {name: /delete folder docs\//i}));
		await waitFor(() => screen.getByRole('button', {name: /^delete$/i}));
		await user.click(screen.getByRole('button', {name: /^delete$/i}));
		await waitFor(() => {
			expect(screen.getByText('Partial delete failure')).toBeInTheDocument();
		});
	});
});
