import {useEffect, useRef, useState} from 'react';
import {
	ActionIcon,
	Button,
	Group,
	Loader,
	Skeleton,
	Stack,
	Table,
	Text,
	TextInput,
	Tooltip,
} from '@mantine/core';
import {notifications} from '@mantine/notifications';
import {
	IconCalculator,
	IconChevronLeft,
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
import {useMobile} from '../contexts/MobileContext';
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
	folderSizes: Map<string, number>;
	calculatingFolders: Set<string>;
	onCalculateFolderSize: (prefix: string) => void;
	onGoBack?: (() => void) | undefined;
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

const mobileSectionLabel: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 650,
	letterSpacing: '0.09em',
	textTransform: 'uppercase',
	color: 'var(--text-muted)',
	padding: '14px 16px 6px',
};

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
	folderSizes,
	calculatingFolders,
	onCalculateFolderSize,
	onGoBack,
}: ObjectBrowserProps) => {
	const {isMobile} = useMobile();
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

	if (isMobile) {
		return (
			<MobileObjectBrowser
				bucket={bucket}
				prefix={prefix}
				objects={visibleObjects}
				totalCount={totalCount}
				loading={loading}
				page={page}
				pageSize={pageSize}
				selectedKey={selectedKey}
				uploadProgress={uploadProgress}
				crumbs={crumbs}
				viewMode={viewMode}
				filterText={filterText}
				isDragging={isDragging}
				dragProps={dragProps}
				onNavigate={onNavigate}
				onSelectObject={onSelectObject}
				onPageChange={onPageChange}
				onPageSizeChange={onPageSizeChange}
				onUploadClick={onUploadClick}
				onSetViewMode={setViewMode}
				onSetFilterText={setFilterText}
				onGoBack={onGoBack}
				folderSizes={folderSizes}
				calculatingFolders={calculatingFolders}
				onCalculateFolderSize={onCalculateFolderSize}
			/>
		);
	}

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
											fontFamily: 'var(--font-display)',
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
											fontFamily: 'var(--font-display)',
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
								<Table.Th style={{...thStyle, width: '55%', paddingTop: 14}}>
									Name
								</Table.Th>
								<Table.Th
									style={{
										...thStyle,
										width: '16%',
										textAlign: 'right',
										paddingTop: 14,
									}}
								>
									Size
								</Table.Th>
								<Table.Th style={{...thStyle, width: '22%', paddingTop: 14}}>
									Last Modified
								</Table.Th>
								<Table.Th style={{...thStyle, width: '7%', paddingTop: 14}} />
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
									folderSizes={folderSizes}
									calculatingFolders={calculatingFolders}
									onCalculateFolderSize={onCalculateFolderSize}
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

interface MobileObjectBrowserProps {
	bucket: string;
	prefix: string;
	objects: S3Object[];
	totalCount: number;
	loading: boolean;
	page: number;
	pageSize: number;
	selectedKey: string | null;
	uploadProgress: UploadProgress | null;
	crumbs: Array<{label: string; prefix: string}>;
	viewMode: 'table' | 'gallery';
	filterText: string;
	isDragging: boolean;
	dragProps: React.HTMLAttributes<HTMLDivElement>;
	onNavigate: (prefix: string) => void;
	onSelectObject: (key: string | null) => void;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
	onUploadClick: () => void;
	onSetViewMode: (mode: 'table' | 'gallery') => void;
	onSetFilterText: (text: string) => void;
	onGoBack?: (() => void) | undefined;
	folderSizes: Map<string, number>;
	calculatingFolders: Set<string>;
	onCalculateFolderSize: (prefix: string) => void;
}

const MobileObjectBrowser = ({
	bucket,
	prefix,
	objects,
	totalCount,
	loading,
	page,
	pageSize,
	selectedKey,
	uploadProgress,
	crumbs,
	viewMode,
	filterText,
	isDragging,
	dragProps,
	onNavigate,
	onSelectObject,
	onPageChange,
	onPageSizeChange,
	onUploadClick,
	onSetViewMode,
	onSetFilterText,
	onGoBack,
	folderSizes,
	calculatingFolders,
	onCalculateFolderSize,
}: MobileObjectBrowserProps) => {
	const [showFilter, setShowFilter] = useState(false);
	const filterRef = useRef<HTMLInputElement>(null);
	const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (focusTimeoutRef.current !== null) {
				clearTimeout(focusTimeoutRef.current);
			}
		};
	}, []);

	const folders = objects.filter((o) => o.isPrefix);
	const files = objects.filter((o) => !o.isPrefix);

	const parentLabel = crumbs.length > 1 ? (crumbs[crumbs.length - 2]?.label ?? bucket) : null;
	const currentLabel = crumbs[crumbs.length - 1]?.label ?? bucket;

	return (
		<div
			data-testid="object-browser"
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				position: 'relative',
				background: 'var(--bg-base)',
			}}
			{...dragProps}
		>
			<DragOverlay show={isDragging} />

			{/* Mobile top header */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 8,
					padding: '0 8px 0 4px',
					height: 56,
					borderBottom: '1px solid var(--border-color)',
					background: 'var(--bg-base)',
					flexShrink: 0,
				}}
			>
				<button
					onClick={
						prefix !== ''
							? () => onNavigate(crumbs[crumbs.length - 2]?.prefix ?? '')
							: (onGoBack ?? undefined)
					}
					aria-label="Go back"
					style={{
						background: 'none',
						border: 'none',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						minWidth: 44,
						minHeight: 44,
						color: 'var(--accent-text)',
						flexShrink: 0,
					}}
				>
					<IconChevronLeft size={22} />
				</button>

				<div style={{flex: 1, minWidth: 0}}>
					<Text
						fw={600}
						truncate
						style={{
							fontFamily: 'var(--font-display)',
							fontSize: 15,
							color: 'var(--text-primary)',
							lineHeight: 1.2,
						}}
					>
						{bucket}
					</Text>
					{prefix !== '' && (
						<Text
							truncate
							style={{
								fontSize: 12,
								color: 'var(--text-muted)',
								lineHeight: 1.2,
							}}
						>
							{parentLabel !== null && parentLabel !== bucket
								? `${parentLabel} / ${currentLabel}`
								: currentLabel}
						</Text>
					)}
				</div>

				<button
					onClick={() => {
						setShowFilter((v) => !v);
						if (focusTimeoutRef.current !== null) {
							clearTimeout(focusTimeoutRef.current);
						}
						focusTimeoutRef.current = setTimeout(() => filterRef.current?.focus(), 50);
					}}
					aria-label="Toggle search"
					style={{
						background: 'none',
						border: 'none',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						minWidth: 44,
						minHeight: 44,
						color: 'var(--text-muted)',
						flexShrink: 0,
					}}
				>
					<IconSearch size={18} />
				</button>
			</div>

			{/* Filter bar (when shown) */}
			{showFilter && (
				<div
					style={{
						padding: '8px 12px',
						background: 'var(--bg-base)',
						borderBottom: '1px solid var(--border-color)',
					}}
				>
					<TextInput
						ref={filterRef}
						size="sm"
						placeholder="Filter files…"
						leftSection={<IconSearch size={13} />}
						value={filterText}
						onChange={(e) => {
							onSetFilterText(e.currentTarget.value);
						}}
						styles={{
							input: {
								background: 'var(--bg-surface)',
								border: '1px solid var(--border-color)',
								color: 'var(--text-primary)',
								fontSize: 14,
							},
						}}
						aria-label="Filter visible"
					/>
				</div>
			)}

			{/* View toggle + count bar */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '8px 16px',
					borderBottom: '1px solid var(--border-color)',
					background: 'var(--bg-base)',
					flexShrink: 0,
				}}
			>
				<div style={{display: 'flex', gap: 4}}>
					<button
						onClick={() => {
							onSetViewMode('table');
						}}
						aria-label="List view"
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 5,
							padding: '6px 12px',
							border: '1px solid var(--border-color)',
							borderRadius: 6,
							cursor: 'pointer',
							background: viewMode === 'table' ? 'var(--accent-dim)' : 'transparent',
							color:
								viewMode === 'table' ? 'var(--accent-text)' : 'var(--text-muted)',
							fontSize: 13,
							fontWeight: viewMode === 'table' ? 500 : 400,
							minHeight: 36,
						}}
					>
						<IconList size={14} />
						List
					</button>
					<button
						onClick={() => {
							onSetViewMode('gallery');
						}}
						aria-label="Grid view"
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 5,
							padding: '6px 12px',
							border: '1px solid var(--border-color)',
							borderRadius: 6,
							cursor: 'pointer',
							background:
								viewMode === 'gallery' ? 'var(--accent-dim)' : 'transparent',
							color:
								viewMode === 'gallery' ? 'var(--accent-text)' : 'var(--text-muted)',
							fontSize: 13,
							fontWeight: viewMode === 'gallery' ? 500 : 400,
							minHeight: 36,
						}}
					>
						<IconLayoutGrid size={14} />
						Grid
					</button>
				</div>
				<Text style={{fontSize: 13, color: 'var(--text-muted)'}}>
					{loading ? '…' : `${totalCount} items`}
				</Text>
			</div>

			{/* Upload progress */}
			{uploadProgress !== null && (
				<div
					style={{
						padding: '5px 16px',
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

			{/* Scrollable content */}
			<div style={{flex: 1, overflowY: 'auto', paddingBottom: 80}}>
				{loading && (
					<Stack gap={0} p={0}>
						{[1, 2, 3, 4, 5, 6].map((n) => (
							<Skeleton key={n} height={60} radius={0} style={{marginBottom: 1}} />
						))}
					</Stack>
				)}

				{!loading && objects.length === 0 && (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							padding: '80px 40px',
							gap: 14,
						}}
					>
						<IconFolder size={48} style={{color: 'var(--text-muted)'}} />
						<Text style={{color: 'var(--text-muted)', fontSize: 15}}>
							{filterText ? 'No matches for your filter' : 'This folder is empty'}
						</Text>
					</div>
				)}

				{!loading && objects.length > 0 && viewMode === 'gallery' && (
					<div style={{padding: 12}}>
						<GalleryView
							objects={objects}
							bucket={bucket}
							prefix={prefix}
							onNavigate={onNavigate}
							onSelectObject={onSelectObject}
						/>
					</div>
				)}

				{!loading && objects.length > 0 && viewMode === 'table' && (
					<>
						{folders.length > 0 && (
							<>
								<div style={mobileSectionLabel}>Folders</div>
								{folders.map((obj) => (
									<MobileFolderRow
										key={obj.key}
										obj={obj}
										prefix={prefix}
										onNavigate={onNavigate}
									/>
								))}
							</>
						)}

						{files.length > 0 && (
							<>
								<div style={mobileSectionLabel}>Files</div>
								{files.map((obj) => (
									<MobileFileRow
										key={obj.key}
										obj={obj}
										prefix={prefix}
										isSelected={obj.key === selectedKey}
										onSelectObject={onSelectObject}
									/>
								))}
							</>
						)}
					</>
				)}

				{!loading && (
					<div style={{padding: '8px 16px'}}>
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

			{/* Sticky upload button */}
			<div
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
					padding: '10px 16px',
					background: 'var(--bg-base)',
					borderTop: '1px solid var(--border-color)',
				}}
			>
				<Button
					leftSection={<IconUpload size={16} />}
					variant="filled"
					color="kgreen"
					onClick={onUploadClick}
					disabled={uploadProgress !== null}
					fullWidth
					style={{height: 48, fontSize: 15}}
				>
					Upload
				</Button>
			</div>
		</div>
	);
};

interface MobileFolderRowProps {
	obj: S3Object;
	prefix: string;
	onNavigate: (p: string) => void;
}

const MobileFolderRow = ({obj, prefix, onNavigate}: MobileFolderRowProps) => {
	const name = obj.key.slice(prefix.length).replace(/\/$/, '');
	return (
		<button
			onClick={() => {
				onNavigate(obj.key);
			}}
			aria-label={`Open folder ${name}`}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 12,
				width: '100%',
				padding: '0 16px',
				minHeight: 56,
				background: 'none',
				border: 'none',
				borderBottom: '1px solid var(--border-color)',
				cursor: 'pointer',
				textAlign: 'left',
			}}
		>
			<IconFolder size={18} style={{color: 'var(--text-muted)', flexShrink: 0}} />
			<Text
				truncate
				style={{
					flex: 1,
					fontSize: 15,
					color: 'var(--text-primary)',
					minWidth: 0,
				}}
			>
				{name}
			</Text>
			<span style={{color: 'var(--text-muted)', fontSize: 18, flexShrink: 0}}>›</span>
		</button>
	);
};

interface MobileFileRowProps {
	obj: S3Object;
	prefix: string;
	isSelected: boolean;
	onSelectObject: (key: string | null) => void;
}

const MobileFileRow = ({obj, prefix, isSelected, onSelectObject}: MobileFileRowProps) => {
	const name = obj.key.slice(prefix.length);
	const rowBg = isSelected ? 'var(--accent-dim)' : 'transparent';

	return (
		<button
			onClick={() => {
				onSelectObject(isSelected ? null : obj.key);
			}}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 12,
				width: '100%',
				padding: '0 16px',
				minHeight: 60,
				background: rowBg,
				border: 'none',
				borderBottom: '1px solid var(--border-color)',
				boxShadow: isSelected ? 'inset 2px 0 0 var(--accent)' : undefined,
				cursor: 'pointer',
				textAlign: 'left',
			}}
		>
			<IconFile size={18} style={{color: 'var(--text-muted)', flexShrink: 0}} />
			<div style={{flex: 1, minWidth: 0}}>
				<Text
					truncate
					style={{
						fontFamily: 'var(--font-display)',
						fontSize: 14,
						color: 'var(--text-primary)',
						lineHeight: 1.3,
					}}
				>
					{name}
				</Text>
				<Text
					style={{
						fontSize: 12,
						color: 'var(--text-muted)',
						marginTop: 2,
						fontFeatureSettings: '"tnum"',
					}}
				>
					{formatSize(obj.size)} ·{' '}
					{obj.lastModified !== '' ? formatDate(obj.lastModified) : '—'}
				</Text>
			</div>
		</button>
	);
};

interface ObjectRowProps {
	obj: S3Object;
	prefix: string;
	bucket: string;
	isSelected: boolean;
	folderSizes: Map<string, number>;
	calculatingFolders: Set<string>;
	onCalculateFolderSize: (prefix: string) => void;
	onNavigate: (p: string) => void;
	onSelectObject: (key: string | null) => void;
}

const ObjectRow = ({
	obj,
	prefix,
	bucket,
	isSelected,
	folderSizes,
	calculatingFolders,
	onCalculateFolderSize,
	onNavigate,
	onSelectObject,
}: ObjectRowProps) => {
	const [hovered, setHovered] = useState(false);
	const name = obj.key.slice(prefix.length);

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
								fontFamily: 'var(--font-display)',
								fontSize: 14,
								color: 'var(--text-primary)',
							}}
						>
							{name}
						</Text>
					</button>
				)}
			</Table.Td>

			{/* Size */}
			<Table.Td style={{...tdBase, textAlign: 'right'}}>
				<div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center'}}>
					{obj.isPrefix ? (
						calculatingFolders.has(obj.key) ? (
							<Loader size="xs" />
						) : folderSizes.has(obj.key) ? (
							<span
								style={{
									fontSize: 14,
									color: 'var(--text-muted)',
									fontFeatureSettings: '"tnum"',
								}}
							>
								{formatSize(folderSizes.get(obj.key)!)}
							</span>
						) : (
							<Tooltip label="Calculate size">
								<ActionIcon
									variant="subtle"
									color="gray"
									size="xs"
									onClick={(e) => {
										e.stopPropagation();
										onCalculateFolderSize(obj.key);
									}}
									aria-label={`Calculate size of ${name}`}
								>
									<IconCalculator size={13} />
								</ActionIcon>
							</Tooltip>
						)
					) : (
						<span
							style={{
								fontSize: 14,
								color: 'var(--text-muted)',
								fontFeatureSettings: '"tnum"',
							}}
						>
							{formatSize(obj.size)}
						</span>
					)}
				</div>
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
