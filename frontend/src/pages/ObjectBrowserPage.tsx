import {useEffect, useRef, useState} from 'react';
import {useParams, useSearchParams} from 'react-router-dom';
import {Progress, Stack, Text} from '@mantine/core';
import {notifications} from '@mantine/notifications';
import streamSaver from 'streamsaver';
import type {S3Object} from '@shared/types';
import {
	abortMultipartUpload,
	completeMultipartUpload,
	createMultipartUpload,
	fetchObjects,
	uploadPart,
} from '../api/client';
import {ObjectBrowser} from '../components/ObjectBrowser';
import {ObjectInspector} from '../components/ObjectInspector';

interface UploadProgress {
	done: number;
	total: number;
	filename: string;
	fileProgress: number;
}

const CHUNK_SIZE = 8 * 1024 * 1024;

export const ObjectBrowserPage = () => {
	const {bucket} = useParams<{bucket: string}>();
	const [searchParams, setSearchParams] = useSearchParams();

	const prefix = searchParams.get('prefix') ?? '';
	const selectedKey = searchParams.get('key') ?? null;
	const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
	const pageSize = (() => {
		const ps = parseInt(searchParams.get('pageSize') ?? '100', 10);
		return [50, 100, 200, 300].includes(ps) ? ps : 100;
	})();

	const [objects, setObjects] = useState<S3Object[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);

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

	const navigateTo = (newPrefix: string) => {
		setSearchParams(() => {
			const next = new URLSearchParams();
			if (newPrefix !== '') {
				next.set('prefix', newPrefix);
			}
			return next;
		});
	};

	const selectObject = (key: string | null) => {
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			if (key === null) {
				next.delete('key');
			} else {
				next.set('key', key);
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

	const handleDeleteFolder = (folderPrefix: string) => {
		void (async () => {
			try {
				const url = `/api/buckets/${encodeURIComponent(bucket)}/folder?prefix=${encodeURIComponent(folderPrefix)}`;
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
					setRefreshKey((k) => k + 1);
					return;
				}
				if (!res.ok) {
					throw new Error(`Delete failed: ${res.status}`);
				}
				setRefreshKey((k) => k + 1);
			} catch (err) {
				notifications.show({
					title: 'Failed to delete folder',
					message: err instanceof Error ? err.message : 'Unknown error',
					color: 'red',
				});
			}
		})();
	};

	const handleDeleteObject = (key: string) => {
		selectObject(null);
		setRefreshKey((k) => k + 1);
	};

	const handleDownloadFolder = async (folderPrefix: string): Promise<void> => {
		const folderName = folderPrefix.split('/').filter(Boolean).pop() ?? bucket;
		const url = `/api/buckets/${encodeURIComponent(bucket)}/download-folder?prefix=${encodeURIComponent(folderPrefix)}`;
		const res = await fetch(url);
		if (!res.ok || res.body === null) {
			throw new Error(`Download failed: ${res.status}`);
		}
		const fileStream = streamSaver.createWriteStream(`${folderName}.zip`);
		await res.body.pipeTo(fileStream);
	};

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
			setRefreshKey((k) => k + 1);
		}
	};

	const selectedObject =
		selectedKey !== null ? objects.find((o) => o.key === selectedKey) : undefined;

	const showInspector = selectedKey !== null;

	return (
		<div style={{display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden'}}>
			{/* Hidden file inputs */}
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

			{/* Upload progress bar */}
			{uploadProgress !== null && (
				<Stack
					gap={4}
					style={{
						position: 'fixed',
						top: 0,
						left: 'var(--rail-width)',
						right: 0,
						zIndex: 100,
						padding: '6px 16px',
						background: 'var(--bg-surface)',
						borderBottom: '1px solid var(--border-color)',
					}}
				>
					<Text size="xs" c="dimmed">
						{uploadProgress.filename} ({uploadProgress.done + 1}/{uploadProgress.total})
					</Text>
					<Progress value={uploadProgress.fileProgress} size="sm" color="var(--accent)" />
				</Stack>
			)}

			{/* When inspector is open and object is an image: full-attention mode */}
			{showInspector && selectedObject !== undefined ? (
				<div
					style={{
						position: 'fixed',
						top: 0,
						right: 0,
						bottom: 0,
						left: 'var(--rail-width)',
						zIndex: 10,
						overflow: 'hidden',
					}}
				>
					<ObjectInspector
						bucket={bucket}
						objectKey={selectedKey}
						size={selectedObject.size}
						lastModified={selectedObject.lastModified}
						etag={selectedObject.etag ?? undefined}
						contentType={selectedObject.contentType ?? undefined}
						siblings={objects}
						onClose={() => {
							selectObject(null);
						}}
						onDelete={handleDeleteObject}
						onNavigate={(key) => {
							selectObject(key);
						}}
					/>
				</div>
			) : showInspector && selectedObject === undefined ? (
				/* Key in URL but not yet in loaded objects — show browser alongside */
				<div style={{display: 'flex', flex: 1, minHeight: 0}}>
					<div
						style={{
							flex: 1,
							overflow: 'hidden',
							display: 'flex',
							flexDirection: 'column',
						}}
					>
						<ObjectBrowser
							bucket={bucket}
							prefix={prefix}
							objects={objects}
							totalCount={totalCount}
							loading={loading}
							page={page}
							pageSize={pageSize}
							selectedKey={selectedKey}
							uploadProgress={uploadProgress}
							onNavigate={navigateTo}
							onSelectObject={selectObject}
							onPageChange={handlePageChange}
							onPageSizeChange={handlePageSizeChange}
							onUploadClick={() => {
								fileInputRef.current?.click();
							}}
							onFolderUploadClick={() => {
								folderInputRef.current?.click();
							}}
							onDownloadFolder={handleDownloadFolder}
							onDeleteFolder={handleDeleteFolder}
						/>
					</div>
				</div>
			) : (
				/* No selection: full-width browser */
				<div
					style={{flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column'}}
				>
					<ObjectBrowser
						bucket={bucket}
						prefix={prefix}
						objects={objects}
						totalCount={totalCount}
						loading={loading}
						page={page}
						pageSize={pageSize}
						selectedKey={selectedKey}
						uploadProgress={uploadProgress}
						onNavigate={navigateTo}
						onSelectObject={selectObject}
						onPageChange={handlePageChange}
						onPageSizeChange={handlePageSizeChange}
						onUploadClick={() => {
							fileInputRef.current?.click();
						}}
						onFolderUploadClick={() => {
							folderInputRef.current?.click();
						}}
						onDownloadFolder={handleDownloadFolder}
						onDeleteFolder={handleDeleteFolder}
					/>
				</div>
			)}
		</div>
	);
};
