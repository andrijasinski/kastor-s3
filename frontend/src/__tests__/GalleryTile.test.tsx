import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {MantineProvider} from '@mantine/core';
import {GalleryTile} from '../components/GalleryTile';
import type {S3Object} from '@shared/types';

const renderTile = (obj: S3Object, onNavigate = vi.fn()) =>
	render(
		<MantineProvider>
			<MemoryRouter>
				<GalleryTile
					obj={obj}
					bucket="my-bucket"
					prefix=""
					siblings={[]}
					onNavigate={onNavigate}
				/>
			</MemoryRouter>
		</MantineProvider>,
	);

describe('GalleryTile', () => {
	it('shows filename below tile', () => {
		const obj: S3Object = {key: 'report.pdf', size: 2048, lastModified: '', isPrefix: false};
		renderTile(obj);
		expect(screen.getByText('report.pdf')).toBeInTheDocument();
	});

	it('shows formatted file size below tile', () => {
		const obj: S3Object = {key: 'report.pdf', size: 2048, lastModified: '', isPrefix: false};
		renderTile(obj);
		expect(screen.getByText('2.0 KB')).toBeInTheDocument();
	});

	it('shows folder icon when isPrefix is true', () => {
		const obj: S3Object = {key: 'photos/', size: 0, lastModified: '', isPrefix: true};
		renderTile(obj);
		expect(screen.getByRole('button', {name: /open folder photos\//i})).toBeInTheDocument();
	});

	it('shows file icon for non-image file', () => {
		const obj: S3Object = {key: 'report.pdf', size: 1024, lastModified: '', isPrefix: false};
		renderTile(obj);
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});

	it('shows img tag for image file', () => {
		const obj: S3Object = {key: 'photo.jpg', size: 1024, lastModified: '', isPrefix: false};
		renderTile(obj);
		const img = screen.getByRole('img', {name: /photo.jpg/i});
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute('loading', 'lazy');
	});

	it('folder tile calls onNavigate on click', async () => {
		const user = userEvent.setup();
		const onNavigate = vi.fn();
		const obj: S3Object = {key: 'photos/', size: 0, lastModified: '', isPrefix: true};
		renderTile(obj, onNavigate);
		await user.click(screen.getByRole('button', {name: /open folder photos\//i}));
		expect(onNavigate).toHaveBeenCalledWith('photos/');
	});

	it('image tile links to preview page', () => {
		const obj: S3Object = {key: 'photo.jpg', size: 1024, lastModified: '', isPrefix: false};
		renderTile(obj);
		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', '/buckets/my-bucket/preview?key=photo.jpg');
	});
});
