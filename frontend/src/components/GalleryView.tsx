import type {S3Object} from '@shared/types';
import {GalleryTile} from './GalleryTile';

interface GalleryViewProps {
	objects: S3Object[];
	bucket: string;
	prefix: string;
	onNavigate: (newPrefix: string) => void;
}

const gridStyle: React.CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
	gap: 16,
};

export const GalleryView = ({objects, bucket, prefix, onNavigate}: GalleryViewProps) => {
	const siblings = objects.filter((o) => !o.isPrefix);

	return (
		<div style={gridStyle}>
			{objects.map((obj) => (
				<GalleryTile
					key={obj.key}
					obj={obj}
					bucket={bucket}
					prefix={prefix}
					siblings={siblings}
					onNavigate={onNavigate}
				/>
			))}
		</div>
	);
};
