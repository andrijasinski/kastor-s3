import {useEffect, useRef, useState} from 'react';
import {Button, Group, Skeleton, Stack, Table, Text, TextInput, Tooltip} from '@mantine/core';
import {notifications} from '@mantine/notifications';
import {
	IconDownload,
	IconFile,
	IconFolder,
	IconLayoutGrid,
	IconList,
	IconSearch,
	IconTrash,
	IconUpload,
} from '@tabler/icons-react';
import streamSaver from 'streamsaver';
import type {S3Object} from '@shared/types';
import {buildBreadcrumbSegments} from '../utils/breadcrumbs';
import {formatDate, formatSize} from '../utils/format';
import {DragOverlay} from './DragOverlay';
import {GalleryView} from './GalleryView';
import {PaginationControls} from './Pagination';

interface UploadProgress {
	done: number;
	total: number;
	filename: string;
	fileProgress: number;
}

interface ObjectBrowserProps {
	bucket: string;
	prefix: string;
	objects: S3Object[];
	totalCount: number;
	loading: boolean;
	page: number;
	pageSize: number;
	selectedKey: string | null;
	uploadProgress: UploadProgress | null;
	isDragging: boolean;
	dragProps: React.HTMLAttributes<HTMLDivElement>;
	onNavigate: (prefix: string) => void;
	onSelectObject: (key: string | null) => void;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
	onUploadClick: () => void;
	onFolderUploadClick: () => void;
	onDownloadFolder: (prefix: string) => Promise<void>;
	onDeleteFolder: (prefix: string) => void;
}

const crumbSep: React.CSSProperties = {
	color: 'var(--text-muted)',
	margin: '0 5px',
	fontSize: 15,
	lineHeight: 1,
};

const thStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 650,
	letterSpacing: '0.07em',
	textTransform: 'uppercase',
	color: 'var(--text-muted)',
	padding: '0 16px 12px',
	borderBottom: '1px solid var(--border-strong)',
	whiteSpace: 'nowrap',
};

const iconBtn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
	background: 'none',
	border: '1px solid var(--border-color)',
	borderRadius: 5,
	cursor: 'pointer',
	padding: '5px 8px',
	color: 'var(--text-muted)',
	display: 'flex',
	alignItems: 'center',
	flexShrink: 0,
	...extra,
});

export const ObjectBrowser = ({
	bucket,
	prefix,
	objects,
	totalCount,
	loading,
	page,
	pageSize,
	selectedKey,
	uploadProgress,
	isDragging,
	dragProps,
	onNavigate,
	onSelectObject,
	onPageChange,
	onPageSizeChange,
	onUploadClick,
	onFolderUploadClick,
	onDownloadFolder,
	onDeleteFolder,
}: ObjectBrowserProps) => {
	const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table');
	const [filterText, setFilterText] = useState('');
	const [deleteFolderConfirm, setDeleteFolderConfirm] = useState(false);
	const [downloadingFolder, setDownloadingFolder] = useState(false);
	const filterRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setViewMode('table');
		setFilterText('');
	}, [prefix]);

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				filterRef.current?.focus();
			}
			if (e.key === 'g' || e.key === 'G') {
				const active = document.activeElement;
				if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
					return;
				}
				setViewMode((v) => (v === 'table' ? 'gallery' : 'table'));
			}
		};
		window.addEventListener('keydown', handleKey);
		return () => {
			window.removeEventListener('keydown', handleKey);
		};
	}, []);

	const crumbs: Array<{label: string; prefix: string}> = [
		{label: bucket, prefix: ''},
		...buildBreadcrumbSegments(prefix).map((seg) => ({
			label: seg.label,
			prefix: seg.prefix ?? '',
		})),
	];

	const lowerFilter = filterText.toLowerCase();
	const visibleObjects = filterText
		? objects.filter((obj) => {
				const name = obj.key.slice(prefix.length).toLowerCase();
				return name.includes(lowerFilter);
			})
		: objects;

	const handleDownloadFolder = async (folderPrefix: string) => {
		setDownloadingFolder(true);
		try {
			const folderName = folderPrefix.split('/').filter(Boolean).pop() ?? bucket;
			const url = `/api/buckets/${encodeURIComponent(bucket)}/download-folder?prefix=${encodeURIComponent(folderPrefix)}`;
			const res = await fetch(url);
			if (!res.ok || res.body === null) {
				throw new Error(`Download failed: ${res.status}`);
			}
			const fileStream = streamSaver.createWriteStream(`${folderName}.zip`);
			await res.body.pipeTo(fileStream);
		} catch (err) {
			notifications.show({
				title: 'Failed to download folder',
				message: err instanceof Error ? err.message : 'Unknown error',
				color: 'red',
			});
		} finally {
			setDownloadingFolder(false);
		}
	};

	return (
		<div
			data-testid="object-browser"
			style={{display: 'flex', flexDirection: 'column', height: '100%', position: 'relative'}}
			{...dragProps}
		>
			<DragOverlay show={isDragging} />
			{/* Top bar */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 10,
					padding: '0 20px',
					height: 56,
					borderBottom: '1px solid var(--border-color)',
					background: 'var(--bg-base)',
					flexShrink: 0,
					overflow: 'hidden',
				}}
			>
				{/* Breadcrumbs */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						flex: 1,
						minWidth: 0,
						overflow: 'hidden',
					}}
				>
					{crumbs.map((crumb, i) => {
						const isLast = i === crumbs.length - 1;
						const isBucket = i === 0;
						return (
							<span
								key={`${crumb.prefix}-${i}`}
								style={{
									display: 'flex',
									alignItems: 'center',
									flexShrink: i === 0 ? 0 : 1,
									minWidth: 0,
								}}
							>
								{i > 0 && <span style={crumbSep}>/</span>}
								{isLast ? (
									<Text
										fw={500}
										truncate
										style={{
											color: 'var(--text-primary)',
											fontFamily: isBucket
												? 'var(--font-display)'
												: 'var(--font-mono)',
											fontSize: isBucket ? 15 : 13,
										}}
									>
										{crumb.label}
									</Text>
								) : (
									<button
										onClick={() => {
											onNavigate(crumb.prefix);
										}}
										style={{
											background: 'none',
											border: 'none',
											padding: '2px 4px',
											cursor: 'pointer',
											color: 'var(--accent-text)',
											fontSize: isBucket ? 15 : 13,
											fontFamily: isBucket
												? 'var(--font-display)'
												: 'var(--font-mono)',
											borderRadius: 3,
											flexShrink: 0,
										}}
									>
										{crumb.label}
									</button>
								)}
							</span>
						);
					})}
				</div>

				{/* Folder actions */}
				{prefix !== '' && !deleteFolderConfirm && (
					<Group gap={4} style={{flexShrink: 0}}>
						<Tooltip label={`Download ${prefix} as zip`}>
							<button
								onClick={() => {
									void handleDownloadFolder(prefix);
								}}
								disabled={downloadingFolder}
								aria-label={`Download folder ${prefix}`}
								style={iconBtn()}
							>
								<IconDownload size={14} />
							</button>
						</Tooltip>
						<Tooltip label={`Delete folder ${prefix}`}>
							<button
								onClick={() => {
									setDeleteFolderConfirm(true);
								}}
								aria-label={`Delete folder ${prefix}`}
								style={iconBtn({color: 'var(--danger)'})}
							>
								<IconTrash size={14} />
							</button>
						</Tooltip>
					</Group>
				)}
				{prefix !== '' && deleteFolderConfirm && (
					<Group gap={6} style={{flexShrink: 0}}>
						<Text size="sm" style={{color: 'var(--text-muted)'}}>
							Delete folder?
						</Text>
						<Button
							size="xs"
							color="red"
							onClick={() => {
								setDeleteFolderConfirm(false);
								onDeleteFolder(prefix);
							}}
						>
							Delete
						</Button>
						<Button
							size="xs"
							variant="default"
							onClick={() => {
								setDeleteFolderConfirm(false);
							}}
						>
							Cancel
						</Button>
					</Group>
				)}

				{/* Filter */}
				<TextInput
					ref={filterRef}
					size="sm"
					placeholder="Filter visible"
					leftSection={<IconSearch size={13} />}
					rightSection={
						<Text
							style={{
								color: 'var(--text-muted)',
								fontFamily: 'var(--font-mono)',
								fontSize: 11,
							}}
						>
							⌘K
						</Text>
					}
					value={filterText}
					onChange={(e) => {
						setFilterText(e.currentTarget.value);
					}}
					style={{width: 180, flexShrink: 0}}
					styles={{
						input: {
							background: 'var(--bg-surface)',
							border: '1px solid var(--border-color)',
							color: 'var(--text-primary)',
							fontSize: 14,
							height: 34,
						},
					}}
					aria-label="Filter visible"
				/>

				{/* Upload */}
				<Button
					leftSection={<IconUpload size={14} />}
					variant="filled"
					size="sm"
					color="kgreen"
					onClick={onUploadClick}
					disabled={uploadProgress !== null}
					style={{flexShrink: 0, height: 34}}
				>
					Upload
				</Button>
				<Tooltip label="Upload folder">
					<button
						onClick={onFolderUploadClick}
						disabled={uploadProgress !== null}
						aria-label="Upload folder"
						style={iconBtn()}
					>
						<IconUpload size={14} />
					</button>
				</Tooltip>

				{/* View toggle */}
				<div style={{display: 'flex', gap: 3, flexShrink: 0}}>
					<Tooltip label="Table view">
						<button
							onClick={() => {
								setViewMode('table');
							}}
							aria-label="Table view"
							style={iconBtn(
								viewMode === 'table'
									? {
											background: 'var(--accent-dim)',
											border: '1px solid var(--accent-border)',
											color: 'var(--accent-text)',
										}
									: {},
							)}
						>
							<IconList size={15} />
						</button>
					</Tooltip>
					<Tooltip label="Gallery view">
						<button
							onClick={() => {
								setViewMode('gallery');
							}}
							aria-label="Gallery view"
							style={iconBtn(
								viewMode === 'gallery'
									? {
											background: 'var(--accent-dim)',
											border: '1px solid var(--accent-border)',
											color: 'var(--accent-text)',
										}
									: {},
							)}
						>
							<IconLayoutGrid size={15} />
						</button>
					</Tooltip>
				</div>
			</div>

			{/* Upload progress */}
			{uploadProgress !== null && (
				<div
					style={{
						padding: '5px 20px',
						background: 'var(--bg-surface)',
						borderBottom: '1px solid var(--border-color)',
						fontSize: 13,
						color: 'var(--text-muted)',
					}}
				>
					Uploading {uploadProgress.filename} ({uploadProgress.done + 1}/
					{uploadProgress.total}) {uploadProgress.fileProgress}%
				</div>
			)}

			{/* Content */}
			<div style={{flex: 1, overflowY: 'auto', paddingBottom: 24}}>
				{loading && (
					<Stack gap={3} p={20}>
						{[1, 2, 3, 4, 5, 6].map((n) => (
							<Skeleton key={n} height={44} radius={4} />
						))}
					</Stack>
				)}

				{!loading && visibleObjects.length === 0 && (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							padding: '100px 40px',
							gap: 14,
						}}
					>
						<IconFolder size={48} style={{color: 'var(--text-muted)'}} />
						<Text style={{color: 'var(--text-muted)', fontSize: 15}}>
							{filterText ? 'No matches for your filter' : 'This folder is empty'}
						</Text>
					</div>
				)}

				{!loading && visibleObjects.length > 0 && viewMode === 'gallery' && (
					<div style={{padding: 20}}>
						<GalleryView
							objects={visibleObjects}
							bucket={bucket}
							prefix={prefix}
							onNavigate={onNavigate}
							onSelectObject={onSelectObject}
						/>
					</div>
				)}

				{!loading && visibleObjects.length > 0 && viewMode === 'table' && (
					<Table
						style={{tableLayout: 'fixed', borderCollapse: 'collapse', width: '100%'}}
					>
						<Table.Thead>
							<Table.Tr style={{background: 'var(--bg-base)'}}>
								<Table.Th style={{...thStyle, width: '42%', paddingTop: 14}}>
									Name
								</Table.Th>
								<Table.Th style={{...thStyle, width: '13%', paddingTop: 14}}>
									Type
								</Table.Th>
								<Table.Th
									style={{
										...thStyle,
										width: '13%',
										textAlign: 'right',
										paddingTop: 14,
									}}
								>
									Size
								</Table.Th>
								<Table.Th style={{...thStyle, width: '22%', paddingTop: 14}}>
									Last Modified
								</Table.Th>
								<Table.Th style={{...thStyle, width: '10%', paddingTop: 14}} />
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{visibleObjects.map((obj) => (
								<ObjectRow
									key={obj.key}
									obj={obj}
									prefix={prefix}
									bucket={bucket}
									isSelected={obj.key === selectedKey}
									onNavigate={onNavigate}
									onSelectObject={onSelectObject}
								/>
							))}
						</Table.Tbody>
					</Table>
				)}

				{!loading && (
					<div style={{padding: '10px 20px'}}>
						<PaginationControls
							page={page}
							totalCount={totalCount}
							pageSize={pageSize}
							onPageChange={onPageChange}
							onPageSizeChange={onPageSizeChange}
						/>
					</div>
				)}
			</div>
		</div>
	);
};

interface ObjectRowProps {
	obj: S3Object;
	prefix: string;
	bucket: string;
	isSelected: boolean;
	onNavigate: (p: string) => void;
	onSelectObject: (key: string | null) => void;
}

const ObjectRow = ({
	obj,
	prefix,
	bucket,
	isSelected,
	onNavigate,
	onSelectObject,
}: ObjectRowProps) => {
	const [hovered, setHovered] = useState(false);
	const name = obj.key.slice(prefix.length);
	const ext = obj.isPrefix ? '' : (obj.key.split('.').pop()?.toUpperCase() ?? '');

	const rowBg = isSelected
		? 'var(--accent-dim)'
		: hovered
			? 'rgba(242,255,244,0.025)'
			: 'transparent';

	const tdBase: React.CSSProperties = {
		padding: '0 16px',
		height: 46,
		borderBottom: '1px solid var(--border-color)',
		verticalAlign: 'middle',
	};

	return (
		<Table.Tr
			style={{
				background: rowBg,
				boxShadow: isSelected ? 'inset 2px 0 0 var(--accent)' : undefined,
			}}
			onMouseEnter={() => {
				setHovered(true);
			}}
			onMouseLeave={() => {
				setHovered(false);
			}}
		>
			{/* Name */}
			<Table.Td style={tdBase}>
				{obj.isPrefix ? (
					<button
						onClick={() => {
							onNavigate(obj.key);
						}}
						aria-label={`Open folder ${name}`}
						style={{
							background: 'none',
							border: 'none',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							padding: 0,
							width: '100%',
						}}
					>
						<IconFolder size={15} style={{color: 'var(--text-muted)', flexShrink: 0}} />
						<Text
							fw={400}
							truncate
							style={{fontSize: 14, color: 'var(--text-primary)'}}
						>
							{name}
						</Text>
					</button>
				) : (
					<button
						onClick={() => {
							onSelectObject(isSelected ? null : obj.key);
						}}
						style={{
							background: 'none',
							border: 'none',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							padding: 0,
							width: '100%',
							textAlign: 'left',
						}}
					>
						<IconFile size={15} style={{color: 'var(--text-muted)', flexShrink: 0}} />
						<Text
							truncate
							style={{
								fontFamily: 'var(--font-mono)',
								fontSize: 13,
								color: 'var(--text-primary)',
							}}
						>
							{name}
						</Text>
					</button>
				)}
			</Table.Td>

			{/* Type */}
			<Table.Td style={tdBase}>
				{obj.isPrefix ? (
					<span style={{color: 'var(--text-muted)', fontSize: 14}}>—</span>
				) : (
					<span
						style={{
							background: 'rgba(242,255,244,0.04)',
							border: '1px solid var(--border-color)',
							borderRadius: 3,
							padding: '2px 7px',
							fontSize: 11,
							color: 'var(--text-muted2)',
							fontFamily: 'var(--font-mono)',
						}}
					>
						{obj.contentType !== undefined
							? obj.contentType.split('/').pop()?.toUpperCase()
							: ext}
					</span>
				)}
			</Table.Td>

			{/* Size */}
			<Table.Td style={{...tdBase, textAlign: 'right'}}>
				<span
					style={{
						fontSize: 14,
						color: 'var(--text-muted)',
						fontFeatureSettings: '"tnum"',
					}}
				>
					{obj.isPrefix ? '—' : formatSize(obj.size)}
				</span>
			</Table.Td>

			{/* Last Modified */}
			<Table.Td style={tdBase}>
				<span
					style={{
						fontSize: 14,
						color: 'var(--text-muted)',
						fontFeatureSettings: '"tnum"',
					}}
				>
					{obj.isPrefix || obj.lastModified === '' ? '—' : formatDate(obj.lastModified)}
				</span>
			</Table.Td>

			{/* Hover actions */}
			<Table.Td style={tdBase}>
				<div
					style={{
						display: 'flex',
						gap: 4,
						justifyContent: 'flex-end',
						opacity: hovered && !obj.isPrefix ? 1 : 0,
						transition: 'opacity 0.12s',
					}}
				>
					{!obj.isPrefix && (
						<Tooltip label="Download">
							<a
								href={`/api/buckets/${encodeURIComponent(bucket)}/download?key=${encodeURIComponent(obj.key)}`}
								download={name}
								aria-label={`Download ${obj.key}`}
								onClick={(e) => {
									e.stopPropagation();
								}}
								style={{
									display: 'flex',
									alignItems: 'center',
									padding: 5,
									borderRadius: 4,
									color: 'var(--text-muted)',
									textDecoration: 'none',
									border: '1px solid var(--border-color)',
									background: 'var(--bg-surface)',
								}}
							>
								<IconDownload size={13} />
							</a>
						</Tooltip>
					)}
				</div>
			</Table.Td>
		</Table.Tr>
	);
};
