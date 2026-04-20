import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {MantineProvider} from '@mantine/core';
import {GalleryView} from '../components/GalleryView';
import type {S3Object} from '@shared/types';

const objects: S3Object[] = [
	{key: 'docs/', size: 0, lastModified: '', isPrefix: true},
	{key: 'photo.jpg', size: 204800, lastModified: '', isPrefix: false},
	{key: 'report.pdf', size: 1024, lastModified: '', isPrefix: false},
];

const renderView = (onNavigate = vi.fn()) =>
	render(
		<MantineProvider>
			<MemoryRouter>
				<GalleryView
					objects={objects}
					bucket="my-bucket"
					prefix=""
					onNavigate={onNavigate}
				/>
			</MemoryRouter>
		</MantineProvider>,
	);

describe('GalleryView', () => {
	it('renders correct number of tiles', () => {
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

	it('clicking image tile links to preview page', () => {
		renderView();
		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', '/buckets/my-bucket/preview?key=photo.jpg');
	});
});
