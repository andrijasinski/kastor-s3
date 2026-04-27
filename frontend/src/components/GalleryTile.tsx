import {useState} from 'react';
import {Stack, Text, Tooltip, UnstyledButton} from '@mantine/core';
import {IconFile, IconFolder} from '@tabler/icons-react';
import type {S3Object} from '@shared/types';
import {isImageFile} from '../utils/imageUtils';
import {formatSize} from '../utils/format';

interface GalleryTileProps {
	obj: S3Object;
	bucket: string;
	prefix: string;
	siblings: S3Object[];
	onNavigate: (newPrefix: string) => void;
	onSelectObject: ((key: string) => void) | undefined;
}

const tileStyle: React.CSSProperties = {
	width: '100%',
	border: '1px solid var(--border-color)',
	borderRadius: 8,
	overflow: 'hidden',
	cursor: 'pointer',
};

const visualStyle: React.CSSProperties = {
	width: '100%',
	aspectRatio: '4/3',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	background: 'var(--bg-surface)',
};

const imgStyle: React.CSSProperties = {
	width: '100%',
	height: '100%',
	objectFit: 'cover',
	display: 'block',
};

const TileLabel = ({obj, prefix}: {obj: S3Object; prefix: string}) => {
	const name = obj.key.slice(prefix.length);
	const size = obj.isPrefix ? '' : formatSize(obj.size);

	return (
		<Stack gap={2} p={8}>
			<Tooltip label={name} openDelay={400} disabled={name.length < 24}>
				<Text size="xs" fw={500} truncate>
					{name}
				</Text>
			</Tooltip>
			<Text size="xs" c="dimmed">
				{size}
			</Text>
		</Stack>
	);
};

interface ImageTileProps {
	obj: S3Object;
	bucket: string;
	siblings: S3Object[];
	onSelectObject: ((key: string) => void) | undefined;
}

const ImageTile = ({obj, bucket, onSelectObject}: ImageTileProps) => {
	const [errored, setErrored] = useState(false);
	const src = `/api/buckets/${encodeURIComponent(bucket)}/object?key=${encodeURIComponent(obj.key)}`;
	const keyPrefix = obj.key.slice(0, obj.key.lastIndexOf('/') + 1);

	return (
		<UnstyledButton
			onClick={() => {
				if (onSelectObject !== undefined) {
					onSelectObject(obj.key);
				}
			}}
			style={tileStyle}
			aria-label={`Select ${obj.key.slice(keyPrefix.length)}`}
		>
			<div style={visualStyle}>
				{errored ? (
					<IconFile size={48} color="var(--text-muted)" />
				) : (
					<img
						src={src}
						alt={obj.key}
						loading="lazy"
						style={imgStyle}
						onError={() => {
							setErrored(true);
						}}
					/>
				)}
			</div>
			<TileLabel obj={obj} prefix={keyPrefix} />
		</UnstyledButton>
	);
};

export const GalleryTile = ({
	obj,
	bucket,
	prefix,
	siblings,
	onNavigate,
	onSelectObject,
}: GalleryTileProps) => {
	const name = obj.key.slice(prefix.length);

	if (obj.isPrefix) {
		return (
			<UnstyledButton
				onClick={() => {
					onNavigate(obj.key);
				}}
				style={tileStyle}
				aria-label={`Open folder ${name}`}
			>
				<div style={visualStyle}>
					<IconFolder size={48} color="var(--accent-text)" />
				</div>
				<TileLabel obj={obj} prefix={prefix} />
			</UnstyledButton>
		);
	}

	if (isImageFile(obj.key)) {
		return (
			<ImageTile
				obj={obj}
				bucket={bucket}
				siblings={siblings}
				onSelectObject={onSelectObject}
			/>
		);
	}

	return (
		<div style={{...tileStyle, cursor: 'default'}}>
			<div style={visualStyle}>
				<IconFile size={48} color="var(--text-muted)" />
			</div>
			<TileLabel obj={obj} prefix={prefix} />
		</div>
	);
};
