import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MantineProvider} from '@mantine/core';
import {Notifications} from '@mantine/notifications';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {vi} from 'vitest';
import {ObjectInspector} from '../components/ObjectInspector';
import type {S3Object} from '@shared/types';

const server = setupServer(
	http.get('/api/buckets/:bucket/object', () => new HttpResponse(new Uint8Array([1, 2, 3]))),
	http.delete('/api/buckets/:bucket/object', () => HttpResponse.json({ok: true})),
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

const imageSiblings: S3Object[] = [
	{
		key: 'photos/beach.jpg',
		size: 204800,
		lastModified: '2024-06-01T12:00:00.000Z',
		isPrefix: false,
	},
	{
		key: 'photos/mountain.jpg',
		size: 102400,
		lastModified: '2024-06-02T12:00:00.000Z',
		isPrefix: false,
	},
	{
		key: 'photos/report.pdf',
		size: 51200,
		lastModified: '2024-06-03T12:00:00.000Z',
		isPrefix: false,
	},
];

const renderInspector = (
	objectKey: string,
	siblings: S3Object[] = imageSiblings,
	extra: {etag?: string; contentType?: string} = {},
) => {
	const onClose = vi.fn();
	const onDelete = vi.fn();
	const onNavigate = vi.fn();
	const result = render(
		<MantineProvider>
			<Notifications />
			<ObjectInspector
				bucket="my-bucket"
				objectKey={objectKey}
				size={204800}
				lastModified="2024-06-01T12:00:00.000Z"
				etag={extra.etag ?? undefined}
				contentType={extra.contentType ?? undefined}
				siblings={siblings}
				onClose={onClose}
				onDelete={onDelete}
				onNavigate={onNavigate}
			/>
		</MantineProvider>,
	);
	return {onClose, onDelete, onNavigate, ...result};
};

describe('ObjectInspector', () => {
	it('renders an img element for an image file pointing at the object endpoint', () => {
		renderInspector('photos/beach.jpg');
		const img = screen.getByRole('img', {name: 'beach.jpg'});
		expect(img).toHaveAttribute('src', '/api/buckets/my-bucket/object?key=photos%2Fbeach.jpg');
	});

	it('shows loading text while image has not yet loaded', () => {
		renderInspector('photos/beach.jpg');
		expect(screen.getByText('kastor is purring...')).toBeInTheDocument();
	});

	it('hides loading text once image fires onLoad', async () => {
		renderInspector('photos/beach.jpg');
		const img = screen.getByRole('img', {name: 'beach.jpg'});
		await waitFor(() => {
			img.dispatchEvent(new Event('load'));
		});
		await waitFor(() => {
			expect(screen.queryByText('kastor is purring...')).not.toBeInTheDocument();
		});
	});

	it('renders fallback icon for a non-image file', async () => {
		renderInspector('photos/report.pdf');
		await waitFor(() => {
			expect(screen.queryByRole('img', {name: 'report.pdf'})).not.toBeInTheDocument();
			expect(screen.getAllByText('report.pdf').length).toBeGreaterThan(0);
		});
	});

	it('path block contains the full key', () => {
		renderInspector('photos/beach.jpg');
		const pathBlock = screen.getByTestId('path-block');
		expect(pathBlock).toHaveTextContent('photos/beach.jpg');
	});

	it('download button has correct href for the download endpoint', () => {
		renderInspector('photos/beach.jpg');
		const downloadBtn = screen.getByTestId('download-btn');
		expect(downloadBtn).toHaveAttribute(
			'href',
			'/api/buckets/my-bucket/download?key=photos%2Fbeach.jpg',
		);
	});

	it('delete shows inline confirmation on click', async () => {
		const user = userEvent.setup();
		renderInspector('photos/beach.jpg');
		await user.click(screen.getByRole('button', {name: /^delete$/i}));
		await waitFor(() => {
			expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
		});
	});

	it('confirming delete fires DELETE to the object endpoint', async () => {
		let deleteCalled = false;
		server.use(
			http.delete('/api/buckets/:bucket/object', () => {
				deleteCalled = true;
				return HttpResponse.json({ok: true});
			}),
		);
		const user = userEvent.setup();
		const {onDelete} = renderInspector('photos/beach.jpg');
		await user.click(screen.getByRole('button', {name: /^delete$/i}));
		await waitFor(() => screen.getByText(/cannot be undone/i));
		const confirmBtns = screen.getAllByRole('button', {name: /^delete$/i});
		const confirmBtn = confirmBtns.at(0);
		expect(confirmBtn).toBeDefined();
		await user.click(confirmBtn!);
		await waitFor(() => {
			expect(deleteCalled).toBe(true);
			expect(onDelete).toHaveBeenCalledWith('photos/beach.jpg');
		});
	});

	it('cancelling delete does not call DELETE', async () => {
		let deleteCalled = false;
		server.use(
			http.delete('/api/buckets/:bucket/object', () => {
				deleteCalled = true;
				return HttpResponse.json({ok: true});
			}),
		);
		const user = userEvent.setup();
		renderInspector('photos/beach.jpg');
		await user.click(screen.getByRole('button', {name: /^delete$/i}));
		await waitFor(() => screen.getByText(/cannot be undone/i));
		await user.click(screen.getByRole('button', {name: /cancel/i}));
		await waitFor(() => {
			expect(deleteCalled).toBe(false);
			expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
		});
	});

	it('shows FILE section with size and modified', () => {
		renderInspector('photos/beach.jpg');
		expect(screen.getByText('Size')).toBeInTheDocument();
		expect(screen.getByText('Modified')).toBeInTheDocument();
		expect(screen.getByText('200.0 KB')).toBeInTheDocument();
	});

	it('shows ETag placeholder when etag is not provided', () => {
		renderInspector('photos/beach.jpg');
		const etagLabel = screen.getByText('ETag');
		expect(etagLabel).toBeInTheDocument();
	});

	it('shows provided ETag value', () => {
		renderInspector('photos/beach.jpg', imageSiblings, {etag: '"abc123"'});
		expect(screen.getByText('"abc123"')).toBeInTheDocument();
	});

	it('image mode renders prev/next arrow buttons', () => {
		renderInspector('photos/beach.jpg');
		expect(screen.getByRole('button', {name: /previous image/i})).toBeInTheDocument();
		expect(screen.getByRole('button', {name: /next image/i})).toBeInTheDocument();
	});

	it('prev is disabled when on first image', () => {
		renderInspector('photos/beach.jpg');
		expect(screen.getByRole('button', {name: /previous image/i})).toBeDisabled();
	});

	it('next is disabled when on last image', () => {
		renderInspector('photos/mountain.jpg');
		expect(screen.getByRole('button', {name: /next image/i})).toBeDisabled();
	});

	it('clicking next navigates to the next image sibling', async () => {
		const user = userEvent.setup();
		const {onNavigate} = renderInspector('photos/beach.jpg');
		await user.click(screen.getByRole('button', {name: /next image/i}));
		expect(onNavigate).toHaveBeenCalledWith('photos/mountain.jpg');
	});

	it('filmstrip renders sibling images', () => {
		renderInspector('photos/beach.jpg');
		expect(screen.getByRole('button', {name: /go to mountain\.jpg/i})).toBeInTheDocument();
	});

	it('close button calls onClose', async () => {
		const user = userEvent.setup();
		const {onClose} = renderInspector('photos/beach.jpg');
		await user.click(screen.getByRole('button', {name: /close inspector/i}));
		expect(onClose).toHaveBeenCalled();
	});
});
