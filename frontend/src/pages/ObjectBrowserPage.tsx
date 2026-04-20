import {useEffect, useRef, useState} from 'react';
import {useParams, useSearchParams, Link} from 'react-router-dom';
import {
	ActionIcon,
	Anchor,
	Breadcrumbs,
	Button,
	Container,
	Group,
	Loader,
	Modal,
	Progress,
	Stack,
	Table,
	Text,
	Tooltip,
} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {notifications} from '@mantine/notifications';
import {
	IconCalculator,
	IconDownload,
	IconFolderUp,
	IconLayoutGrid,
	IconList,
	IconTrash,
	IconUpload,
} from '@tabler/icons-react';
import streamSaver from 'streamsaver';
import type {S3Object} from '@shared/types';
import {
	abortMultipartUpload,
	completeMultipartUpload,
	createMultipartUpload,
	fetchFolderSize,
	fetchObjects,
	uploadPart,
} from '../api/client';
import {GalleryView} from '../components/GalleryView';
import {PaginationControls} from '../components/Pagination';
import {formatSize, formatDate} from '../utils/format';
import {buildBreadcrumbSegments} from '../utils/breadcrumbs';

const downloadUrl = (bucket: string, key: string): string =>
	`/api/buckets/${encodeURIComponent(bucket)}/download?key=${encodeURIComponent(key)}`;

interface UploadProgress {
	done: number;
	total: number;
	filename: string;
	fileProgress: number;
}

export const ObjectBrowserPage = () => {
	const {bucket} = useParams<{bucket: string}>();
	const [searchParams, setSearchParams] = useSearchParams();
	const prefix = searchParams.get('prefix') ?? '';
	const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
	const pageSize = (() => {
		const ps = parseInt(searchParams.get('pageSize') ?? '100', 10);
		return [50, 100, 200, 300].includes(ps) ? ps : 100;
	})();

	const [objects, setObjects] = useState<S3Object[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [downloadingFolder, setDownloadingFolder] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const [pendingDelete, setPendingDelete] = useState<{key: string; isFolder: boolean} | null>(
		null,
	);
	const [deleting, setDeleting] = useState(false);
	const [folderSizes, setFolderSizes] = useState<Map<string, number>>(new Map());
	const [calculatingFolders, setCalculatingFolders] = useState<Set<string>>(new Set());
	const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table');

	const fileInputRef = useRef<HTMLInputElement>(null);
	const folderInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		folderInputRef.current?.setAttribute('webkitdirectory', '');
	}, []);

	useEffect(() => {
		setViewMode('table');
	}, [prefix]);

	useEffect(() => {
		if (bucket === undefined) {
			return;
		}
		let cancelled = false;
		setObjects([]);
		setLoading(true);
		const offset = (page - 1) * pageSize;
		void fetchObjects(bucket, prefix, offset, pageSize)
			.then(({objects: data, totalCount: count}) => {
				if (!cancelled) {
					setObjects(data);
					setTotalCount(count);
					setLoading(false);
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					notifications.show({
						title: 'Failed to load objects',
						message: err instanceof Error ? err.message : 'Unknown error',
						color: 'red',
					});
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [bucket, prefix, page, pageSize, refreshKey]);

	if (bucket === undefined) {
		return null;
	}

	const invalidateAncestorSizes = (changedPrefix: string) => {
		setFolderSizes((prev) => {
			const next = new Map(prev);
			for (const key of next.keys()) {
				if (changedPrefix.startsWith(key)) {
					next.delete(key);
				}
			}
			return next;
		});
	};

	const calculateFolderSize = async (folderPrefix: string): Promise<void> => {
		setCalculatingFolders((prev) => new Set(prev).add(folderPrefix));
		try {
			const size = await fetchFolderSize(bucket, folderPrefix);
			setFolderSizes((prev) => new Map(prev).set(folderPrefix, size));
		} catch (err) {
			notifications.show({
				title: 'Failed to calculate folder size',
				message: err instanceof Error ? err.message : 'Unknown error',
				color: 'red',
			});
		} finally {
			setCalculatingFolders((prev) => {
				const next = new Set(prev);
				next.delete(folderPrefix);
				return next;
			});
		}
	};

	const crumbs: Array<{label: string; prefix: string | null}> = [
		{label: bucket, prefix: ''},
		...buildBreadcrumbSegments(prefix),
	];

	const navigateTo = (newPrefix: string) => {
		setSearchParams((prev) => {
			const next = new URLSearchParams();
			if (newPrefix !== '') {
				next.set('prefix', newPrefix);
			}
			const ps = prev.get('pageSize');
			if (ps !== null && ps !== '100') {
				next.set('pageSize', ps);
			}
			return next;
		});
	};

	const handlePageChange = (newPage: number) => {
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			next.set('page', newPage.toString());
			return next;
		});
	};

	const handlePageSizeChange = (newSize: number) => {
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			next.set('pageSize', newSize.toString());
			next.delete('page');
			return next;
		});
	};

	const downloadFolder = async (folderPrefix: string): Promise<void> => {
		const folderName = folderPrefix.split('/').filter(Boolean).pop() ?? bucket;
		setDownloadingFolder(folderPrefix);
		try {
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
			setDownloadingFolder(null);
		}
	};

	const confirmDelete = async (): Promise<void> => {
		if (pendingDelete === null) {
			return;
		}
		setDeleting(true);
		try {
			const url = pendingDelete.isFolder
				? `/api/buckets/${encodeURIComponent(bucket)}/folder?prefix=${encodeURIComponent(pendingDelete.key)}`
				: `/api/buckets/${encodeURIComponent(bucket)}/object?key=${encodeURIComponent(pendingDelete.key)}`;
			const res = await fetch(url, {method: 'DELETE'});
			if (res.status === 207) {
				const body = (await res.json()) as {
					error: string;
					failedKeys: Array<{key: string; code: string; message: string}>;
				};
				const count = body.failedKeys.length;
				const names = body.failedKeys
					.slice(0, 3)
					.map((f) => f.key)
					.join(', ');
				const suffix = count > 3 ? ` and ${count - 3} more` : '';
				notifications.show({
					title: 'Partial delete failure',
					message: `${count} file(s) failed to delete: ${names}${suffix}`,
					color: 'orange',
				});
				setPendingDelete(null);
				setRefreshKey((k) => k + 1);
				return;
			}
			if (!res.ok) {
				throw new Error(`Delete failed: ${res.status}`);
			}
			invalidateAncestorSizes(pendingDelete.isFolder ? pendingDelete.key : prefix);
			setPendingDelete(null);
			setRefreshKey((k) => k + 1);
		} catch (err) {
			notifications.show({
				title: 'Failed to delete',
				message: err instanceof Error ? err.message : 'Unknown error',
				color: 'red',
			});
		} finally {
			setDeleting(false);
		}
	};

	const CHUNK_SIZE = 8 * 1024 * 1024;

	const uploadFiles = async (files: FileList): Promise<void> => {
		const fileArray = Array.from(files);
		try {
			for (const [i, file] of fileArray.entries()) {
				const relativePath =
					file.webkitRelativePath !== '' ? file.webkitRelativePath : file.name;
				const key = prefix + relativePath;
				const contentType = file.type !== '' ? file.type : undefined;
				const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

				setUploadProgress({
					done: i,
					total: fileArray.length,
					filename: file.name,
					fileProgress: 0,
				});

				const uploadId = await createMultipartUpload(bucket, key, contentType);
				let bytesUploaded = 0;
				const parts: Array<{partNumber: number; etag: string}> = [];

				try {
					for (let p = 0; p < totalChunks; p++) {
						const start = p * CHUNK_SIZE;
						const chunk = file.slice(start, start + CHUNK_SIZE);
						const etag = await uploadPart(
							bucket,
							key,
							uploadId,
							p + 1,
							chunk,
							(loaded) => {
								setUploadProgress({
									done: i,
									total: fileArray.length,
									filename: file.name,
									fileProgress: Math.round(
										((bytesUploaded + loaded) / Math.max(file.size, 1)) * 100,
									),
								});
							},
						);
						bytesUploaded += chunk.size;
						parts.push({partNumber: p + 1, etag});
					}
					await completeMultipartUpload(bucket, key, uploadId, parts);
				} catch (err) {
					await abortMultipartUpload(bucket, key, uploadId).catch(() => {});
					throw err;
				}
			}
		} catch (err) {
			notifications.show({
				title: 'Upload failed',
				message: err instanceof Error ? err.message : 'Unknown error',
				color: 'red',
			});
		} finally {
			setUploadProgress(null);
			invalidateAncestorSizes(prefix);
			setRefreshKey((k) => k + 1);
		}
	};

	const uploading = uploadProgress !== null;
	const isMobile = useMediaQuery('(max-width: 768px)') ?? false;

	return (
		<Container size="lg" pt="md" pb="xl">
			<Modal
				opened={pendingDelete !== null}
				onClose={() => {
					if (!deleting) {
						setPendingDelete(null);
					}
				}}
				title={pendingDelete?.isFolder ? 'Delete folder' : 'Delete object'}
				size="sm"
			>
				<Text size="sm" mb="lg">
					{pendingDelete?.isFolder
						? 'Are you sure you want to delete all objects in '
						: 'Are you sure you want to delete '}
					<Text span fw={600} style={{wordBreak: 'break-all'}}>
						{pendingDelete?.key}
					</Text>
					? This cannot be undone.
				</Text>
				<Group justify="flex-end">
					<Button
						variant="default"
						onClick={() => {
							setPendingDelete(null);
						}}
						disabled={deleting}
					>
						Cancel
					</Button>
					<Button
						color="red"
						onClick={() => {
							void confirmDelete();
						}}
						loading={deleting}
					>
						Delete
					</Button>
				</Group>
			</Modal>
			<Stack gap="xs" mb="md">
				<Group align="center" gap={24} style={{flexWrap: 'nowrap'}}>
					<Breadcrumbs style={{rowGap: 8, flex: 1, minWidth: 0, paddingLeft: 8}}>
						{crumbs.map((crumb, i) => {
							const isLast = i === crumbs.length - 1;
							const isBucket = i === 0;
							if (isLast && !isBucket) {
								return (
									<Text key={crumb.label} span fw={500}>
										{crumb.label}
									</Text>
								);
							}
							return (
								<Anchor
									key={crumb.prefix ?? crumb.label}
									component="button"
									type="button"
									onClick={() => navigateTo(crumb.prefix ?? '')}
								>
									{crumb.label}
								</Anchor>
							);
						})}
					</Breadcrumbs>

					{!isMobile && (
						<Group gap="xs" style={{flexShrink: 0}}>
							<Button
								leftSection={<IconUpload size={14} />}
								variant="default"
								size="sm"
								disabled={uploading}
								onClick={() => {
									fileInputRef.current?.click();
								}}
							>
								Upload files
							</Button>
							<Button
								leftSection={<IconFolderUp size={14} />}
								variant="default"
								size="sm"
								disabled={uploading}
								onClick={() => {
									folderInputRef.current?.click();
								}}
							>
								Upload folder
							</Button>
							<Tooltip label="Table view">
								<ActionIcon
									variant={viewMode === 'table' ? 'filled' : 'subtle'}
									color={viewMode === 'table' ? 'blue' : 'gray'}
									size="sm"
									aria-label="Table view"
									onClick={() => {
										setViewMode('table');
									}}
								>
									<IconList size={14} />
								</ActionIcon>
							</Tooltip>
							<Tooltip label="Gallery view">
								<ActionIcon
									variant={viewMode === 'gallery' ? 'filled' : 'subtle'}
									color={viewMode === 'gallery' ? 'blue' : 'gray'}
									size="sm"
									aria-label="Gallery view"
									onClick={() => {
										setViewMode('gallery');
									}}
								>
									<IconLayoutGrid size={14} />
								</ActionIcon>
							</Tooltip>
						</Group>
					)}
				</Group>

				{isMobile && (
					<Group gap="xs" justify="flex-end">
						<Tooltip label="Table view">
							<ActionIcon
								variant={viewMode === 'table' ? 'filled' : 'subtle'}
								color={viewMode === 'table' ? 'blue' : 'gray'}
								size="sm"
								aria-label="Table view"
								onClick={() => {
									setViewMode('table');
								}}
							>
								<IconList size={14} />
							</ActionIcon>
						</Tooltip>
						<Tooltip label="Gallery view">
							<ActionIcon
								variant={viewMode === 'gallery' ? 'filled' : 'subtle'}
								color={viewMode === 'gallery' ? 'blue' : 'gray'}
								size="sm"
								aria-label="Gallery view"
								onClick={() => {
									setViewMode('gallery');
								}}
							>
								<IconLayoutGrid size={14} />
							</ActionIcon>
						</Tooltip>
					</Group>
				)}
			</Stack>

			{uploadProgress !== null && (
				<Stack gap="xs" mb="md">
					<Text size="sm" c="dimmed">
						{uploadProgress.filename} ({uploadProgress.done + 1}/{uploadProgress.total})
					</Text>
					<Progress value={uploadProgress.fileProgress} size="sm" />
				</Stack>
			)}

			<input
				ref={fileInputRef}
				type="file"
				multiple
				style={{display: 'none'}}
				onChange={(e) => {
					if (e.target.files !== null && e.target.files.length > 0) {
						void uploadFiles(e.target.files);
						e.target.value = '';
					}
				}}
			/>
			<input
				ref={folderInputRef}
				type="file"
				style={{display: 'none'}}
				onChange={(e) => {
					if (e.target.files !== null && e.target.files.length > 0) {
						void uploadFiles(e.target.files);
						e.target.value = '';
					}
				}}
			/>

			{loading && <Text>Loading…</Text>}

			{!loading && viewMode === 'gallery' && (
				<GalleryView
					objects={objects}
					bucket={bucket}
					prefix={prefix}
					onNavigate={navigateTo}
				/>
			)}

			{!loading && viewMode === 'table' && (
				<Table highlightOnHover>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Name</Table.Th>
							{!isMobile && <Table.Th>Size</Table.Th>}
							{!isMobile && <Table.Th>Last modified</Table.Th>}
							<Table.Th />
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{objects.map((obj) => (
							<Table.Tr key={obj.key}>
								<Table.Td>
									{obj.isPrefix ? (
										<Anchor
											component="button"
											type="button"
											style={{textAlign: 'left'}}
											onClick={() => {
												navigateTo(obj.key);
											}}
										>
											{obj.key.slice(prefix.length)}
										</Anchor>
									) : (
										<Anchor
											component={Link}
											to={`/buckets/${encodeURIComponent(bucket)}/preview?key=${encodeURIComponent(obj.key)}`}
											state={{siblings: objects}}
										>
											{obj.key.slice(prefix.length)}
										</Anchor>
									)}
								</Table.Td>
								{!isMobile && (
									<Table.Td>
										{obj.isPrefix ? (
											calculatingFolders.has(obj.key) ? (
												<Loader size="xs" />
											) : folderSizes.has(obj.key) ? (
												<Text span c="dimmed">
													{formatSize(folderSizes.get(obj.key)!)}
												</Text>
											) : (
												<ActionIcon
													onClick={() => {
														void calculateFolderSize(obj.key);
													}}
													variant="subtle"
													color="gray"
													size="sm"
													aria-label={`Calculate size of ${obj.key}`}
												>
													<IconCalculator size={14} />
												</ActionIcon>
											)
										) : (
											<Text span c="dimmed">
												{formatSize(obj.size)}
											</Text>
										)}
									</Table.Td>
								)}
								{!isMobile && (
									<Table.Td>
										<Text span c="dimmed">
											{obj.isPrefix ? '—' : formatDate(obj.lastModified)}
										</Text>
									</Table.Td>
								)}
								<Table.Td>
									<Group gap="xs" justify="flex-end" wrap="nowrap">
										{obj.isPrefix ? (
											<>
												<ActionIcon
													onClick={() => {
														void downloadFolder(obj.key);
													}}
													loading={downloadingFolder === obj.key}
													variant="subtle"
													color="gray"
													size="sm"
													aria-label={`Download ${obj.key}`}
												>
													<IconDownload size={14} />
												</ActionIcon>
												{!isMobile && (
													<ActionIcon
														onClick={() => {
															setPendingDelete({
																key: obj.key,
																isFolder: true,
															});
														}}
														variant="subtle"
														color="red"
														size="sm"
														aria-label={`Delete ${obj.key}`}
													>
														<IconTrash size={14} />
													</ActionIcon>
												)}
											</>
										) : (
											<>
												<ActionIcon
													component="a"
													href={downloadUrl(bucket, obj.key)}
													download={obj.key.split('/').pop()}
													variant="subtle"
													color="gray"
													size="sm"
													aria-label={`Download ${obj.key}`}
												>
													<IconDownload size={14} />
												</ActionIcon>
												{!isMobile && (
													<ActionIcon
														onClick={() => {
															setPendingDelete({
																key: obj.key,
																isFolder: false,
															});
														}}
														variant="subtle"
														color="red"
														size="sm"
														aria-label={`Delete ${obj.key}`}
													>
														<IconTrash size={14} />
													</ActionIcon>
												)}
											</>
										)}
									</Group>
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
			)}

			{!loading && (
				<PaginationControls
					page={page}
					totalCount={totalCount}
					pageSize={pageSize}
					onPageChange={handlePageChange}
					onPageSizeChange={handlePageSizeChange}
				/>
			)}
		</Container>
	);
};
