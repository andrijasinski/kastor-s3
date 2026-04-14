import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
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
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
	IconCalculator,
	IconDownload,
	IconFolderUp,
	IconTrash,
	IconUpload,
} from '@tabler/icons-react';
import type { S3Object } from '@shared/types';
import { fetchFolderSize, fetchObjects } from '../api/client';

const triggerBlobDownload = (blob: Blob, filename: string): void => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

const buildBreadcrumbs = (bucket: string, prefix: string) => {
	const parts = prefix.split('/').filter((p) => p.length > 0);
	return [
		{ label: bucket, prefix: '' },
		...parts.map((part, i) => ({
			label: part,
			prefix: `${parts.slice(0, i + 1).join('/')}/`,
		})),
	];
};

const formatSize = (bytes: number): string => {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (isoString: string): string => {
	if (isoString === '') {
		return '—';
	}
	return new Date(isoString).toLocaleString();
};

const downloadUrl = (bucket: string, key: string): string =>
	`/api/buckets/${encodeURIComponent(bucket)}/download?key=${encodeURIComponent(key)}`;

interface UploadProgress {
	done: number;
	total: number;
	filename: string;
	fileProgress: number;
}

export const ObjectBrowserPage = () => {
	const { bucket } = useParams<{ bucket: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const prefix = searchParams.get('prefix') ?? '';

	const [objects, setObjects] = useState<S3Object[]>([]);
	const [loading, setLoading] = useState(true);
	const [downloadingFolder, setDownloadingFolder] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const [pendingDelete, setPendingDelete] = useState<{ key: string; isFolder: boolean } | null>(
		null,
	);
	const [deleting, setDeleting] = useState(false);
	const [folderSizes, setFolderSizes] = useState<Map<string, number>>(new Map());
	const [calculatingFolders, setCalculatingFolders] = useState<Set<string>>(new Set());

	const fileInputRef = useRef<HTMLInputElement>(null);
	const folderInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		folderInputRef.current?.setAttribute('webkitdirectory', '');
	}, []);

	useEffect(() => {
		if (bucket === undefined) {
			return;
		}
		let cancelled = false;
		setLoading(true);
		void fetchObjects(bucket, prefix)
			.then((data) => {
				if (!cancelled) {
					setObjects(data);
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
	}, [bucket, prefix, refreshKey]);

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

	const crumbs = buildBreadcrumbs(bucket, prefix);

	const navigateTo = (newPrefix: string) => {
		setSearchParams(newPrefix !== '' ? { prefix: newPrefix } : {});
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
			const blob = await res.blob();
			triggerBlobDownload(blob, `${folderName}.zip`);
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
			const res = await fetch(url, { method: 'DELETE' });
			if (!res.ok) {
				throw new Error(`Delete failed: ${res.status}`);
			}
			setObjects((objs) => objs.filter((obj) => obj.key !== pendingDelete.key));
			invalidateAncestorSizes(pendingDelete.isFolder ? pendingDelete.key : prefix);
			setPendingDelete(null);
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

	const uploadFiles = async (files: FileList): Promise<void> => {
		const fileArray = Array.from(files);
		try {
			for (const [i, file] of fileArray.entries()) {
				const relativePath =
					file.webkitRelativePath !== '' ? file.webkitRelativePath : file.name;
				setUploadProgress({
					done: i,
					total: fileArray.length,
					filename: file.name,
					fileProgress: 0,
				});
				const formData = new FormData();
				formData.append('file', file, relativePath);
				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest();
					xhr.open(
						'POST',
						`/api/buckets/${encodeURIComponent(bucket)}/upload?prefix=${encodeURIComponent(prefix)}`,
					);
					xhr.upload.onprogress = (e) => {
						if (e.lengthComputable) {
							setUploadProgress({
								done: i,
								total: fileArray.length,
								filename: file.name,
								fileProgress: Math.round((e.loaded / e.total) * 100),
							});
						}
					};
					xhr.onload = () => {
						if (xhr.status >= 200 && xhr.status < 300) {
							resolve();
						} else {
							reject(new Error(`Upload failed: ${xhr.status}`));
						}
					};
					xhr.onerror = () => {
						reject(new Error('Network error'));
					};
					xhr.send(formData);
				});
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
					<Text span fw={600} style={{ wordBreak: 'break-all' }}>
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
			<Group align="center" mb="md" gap={24} style={{ flexWrap: 'nowrap' }}>
				<Breadcrumbs style={{ rowGap: 8, flex: 1, minWidth: 0, paddingLeft: 8 }}>
					{crumbs.map((crumb, i) => {
						const isLast = i === crumbs.length - 1;
						const isBucket = i === 0;
						if (isLast && !isBucket) {
							return (
								<Text key={crumb.prefix} span fw={500}>
									{crumb.label}
								</Text>
							);
						}
						return (
							<Anchor
								key={crumb.prefix}
								component="button"
								type="button"
								onClick={() => navigateTo(crumb.prefix)}
							>
								{crumb.label}
							</Anchor>
						);
					})}
				</Breadcrumbs>

				{!isMobile && (
					<Group gap="xs" style={{ flexShrink: 0 }}>
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
					</Group>
				)}
			</Group>

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
				style={{ display: 'none' }}
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
				style={{ display: 'none' }}
				onChange={(e) => {
					if (e.target.files !== null && e.target.files.length > 0) {
						void uploadFiles(e.target.files);
						e.target.value = '';
					}
				}}
			/>

			{loading && <Text>Loading…</Text>}

			{!loading && (
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
											style={{ textAlign: 'left' }}
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
											state={{ siblings: objects }}
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
		</Container>
	);
};
