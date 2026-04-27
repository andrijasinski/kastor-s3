import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MantineProvider} from '@mantine/core';
import {vi} from 'vitest';
import {GalleryView} from '../components/GalleryView';
import type {S3Object} from '@shared/types';

const objects: S3Object[] = [
	{key: 'docs/', size: 0, lastModified: '', isPrefix: true},
	{key: 'photo.jpg', size: 204800, lastModified: '2024-01-01T00:00:00.000Z', isPrefix: false},
	{key: 'report.pdf', size: 1024, lastModified: '', isPrefix: false},
];

const renderView = (onNavigate = vi.fn(), onSelectObject = vi.fn()) =>
	render(
		<MantineProvider>
			<GalleryView
				objects={objects}
				bucket="my-bucket"
				prefix=""
				onNavigate={onNavigate}
				onSelectObject={onSelectObject}
			/>
		</MantineProvider>,
	);

describe('GalleryView', () => {
	it('renders the correct number of tiles', () => {
		renderView();
		expect(screen.getByText('docs/')).toBeInTheDocument();
		expect(screen.getByText('photo.jpg')).toBeInTheDocument();
		expect(screen.getByText('report.pdf')).toBeInTheDocument();
	});

	it('image files render as img elements', () => {
		renderView();
		expect(screen.getByRole('img', {name: /photo.jpg/i})).toBeInTheDocument();
	});

	it('non-image files do not render img elements', () => {
		renderView();
		const imgs = screen.getAllByRole('img');
		expect(imgs).toHaveLength(1);
	});

	it('clicking folder tile calls onNavigate with correct prefix', async () => {
		const user = userEvent.setup();
		const onNavigate = vi.fn();
		renderView(onNavigate);
		await user.click(screen.getByRole('button', {name: /open folder docs\//i}));
		expect(onNavigate).toHaveBeenCalledWith('docs/');
	});

	it('clicking image tile calls onSelectObject with the key', async () => {
		const user = userEvent.setup();
		const onSelectObject = vi.fn();
		renderView(vi.fn(), onSelectObject);
		await user.click(screen.getByRole('button', {name: /select photo\.jpg/i}));
		expect(onSelectObject).toHaveBeenCalledWith('photo.jpg');
	});

	it('renders GROUP BY control', () => {
		renderView();
		expect(screen.getByText('Date')).toBeInTheDocument();
		expect(screen.getByText('Type')).toBeInTheDocument();
		expect(screen.getByText('None')).toBeInTheDocument();
	});

	it('renders tile size label', () => {
		renderView();
		expect(screen.getByText('Tile size')).toBeInTheDocument();
	});
});
