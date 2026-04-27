import {useState} from 'react';
import {Group, SegmentedControl, Slider, Text} from '@mantine/core';
import type {S3Object} from '@shared/types';
import {GalleryTile} from './GalleryTile';

type GroupBy = 'date' | 'type' | 'none';

interface GalleryViewProps {
	objects: S3Object[];
	bucket: string;
	prefix: string;
	onNavigate: (newPrefix: string) => void;
	onSelectObject: ((key: string) => void) | undefined;
}

const groupByDate = (objects: S3Object[]): Map<string, S3Object[]> => {
	const map = new Map<string, S3Object[]>();
	for (const obj of objects) {
		if (obj.isPrefix || obj.lastModified === '') {
			const key = 'Folders';
			const group = map.get(key) ?? [];
			group.push(obj);
			map.set(key, group);
			continue;
		}
		const dateKey = new Date(obj.lastModified).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
		const group = map.get(dateKey) ?? [];
		group.push(obj);
		map.set(dateKey, group);
	}
	return map;
};

const groupByType = (objects: S3Object[]): Map<string, S3Object[]> => {
	const map = new Map<string, S3Object[]>();
	for (const obj of objects) {
		const typeKey = obj.isPrefix
			? 'Folder'
			: (obj.key.split('.').pop()?.toUpperCase() ?? 'Unknown');
		const group = map.get(typeKey) ?? [];
		group.push(obj);
		map.set(typeKey, group);
	}
	return map;
};

interface GroupedSectionProps {
	label: string;
	items: S3Object[];
	bucket: string;
	prefix: string;
	siblings: S3Object[];
	tileSize: number;
	onNavigate: (p: string) => void;
	onSelectObject: ((key: string) => void) | undefined;
}

const GroupedSection = ({
	label,
	items,
	bucket,
	prefix,
	siblings,
	tileSize,
	onNavigate,
	onSelectObject,
}: GroupedSectionProps) => (
	<div style={{marginBottom: 24}}>
		<Text
			size="xs"
			fw={600}
			c="dimmed"
			tt="uppercase"
			style={{letterSpacing: '0.08em', marginBottom: 8}}
		>
			{label}
		</Text>
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))`,
				gap: 12,
			}}
		>
			{items.map((obj) => (
				<GalleryTile
					key={obj.key}
					obj={obj}
					bucket={bucket}
					prefix={prefix}
					siblings={siblings}
					onNavigate={onNavigate}
					onSelectObject={onSelectObject}
				/>
			))}
		</div>
	</div>
);

export const GalleryView = ({
	objects,
	bucket,
	prefix,
	onNavigate,
	onSelectObject,
}: GalleryViewProps) => {
	const [groupBy, setGroupBy] = useState<GroupBy>('none');
	const [tileSize, setTileSize] = useState(150);

	const siblings = objects.filter((o) => !o.isPrefix);

	const renderContent = () => {
		if (groupBy === 'none') {
			return (
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))`,
						gap: 12,
					}}
				>
					{objects.map((obj) => (
						<GalleryTile
							key={obj.key}
							obj={obj}
							bucket={bucket}
							prefix={prefix}
							siblings={siblings}
							onNavigate={onNavigate}
							onSelectObject={onSelectObject}
						/>
					))}
				</div>
			);
		}

		const grouped = groupBy === 'date' ? groupByDate(objects) : groupByType(objects);
		return Array.from(grouped.entries()).map(([label, items]) => (
			<GroupedSection
				key={label}
				label={label}
				items={items}
				bucket={bucket}
				prefix={prefix}
				siblings={siblings}
				tileSize={tileSize}
				onNavigate={onNavigate}
				onSelectObject={onSelectObject}
			/>
		));
	};

	return (
		<div>
			{/* Controls */}
			<Group justify="space-between" mb={16} align="center">
				<Group gap={8} align="center">
					<Text size="xs" c="dimmed">
						Group by
					</Text>
					<SegmentedControl
						size="xs"
						value={groupBy}
						onChange={(v) => {
							setGroupBy(v as GroupBy);
						}}
						data={[
							{label: 'Date', value: 'date'},
							{label: 'Type', value: 'type'},
							{label: 'None', value: 'none'},
						]}
					/>
				</Group>
				<Group gap={8} align="center" style={{width: 120}}>
					<Text size="xs" c="dimmed" style={{whiteSpace: 'nowrap'}}>
						Tile size
					</Text>
					<Slider
						min={80}
						max={240}
						value={tileSize}
						onChange={setTileSize}
						style={{flex: 1}}
						size="xs"
						aria-label="Tile size"
					/>
				</Group>
			</Group>

			{/* Tiles */}
			{renderContent()}
		</div>
	);
};
