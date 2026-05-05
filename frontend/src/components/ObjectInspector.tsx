import {useState} from 'react';
import {ActionIcon, Button, CopyButton, Group, Skeleton, Stack, Text} from '@mantine/core';
import {notifications} from '@mantine/notifications';
import {
	IconChevronLeft,
	IconChevronRight,
	IconCopy,
	IconDownload,
	IconFile,
	IconTrash,
	IconX,
} from '@tabler/icons-react';
import type {S3Object} from '@shared/types';
import {isImageFile} from '../utils/imageUtils';
import {formatDate, formatSize} from '../utils/format';
import {useMobile} from '../contexts/MobileContext';
import {useSwipe} from '../hooks/useSwipe';

const objectUrl = (bucket: string, key: string): string =>
	`/api/buckets/${encodeURIComponent(bucket)}/object?key=${encodeURIComponent(key)}`;

// Change to try a different loading text style: 'subtle' | 'elegant' | 'brand'
const LOADING_TEXT_STYLE: 'subtle' | 'elegant' | 'brand' = 'subtle';

const loadingTextBase: React.CSSProperties = {
	position: 'absolute',
	top: '50%',
	left: '50%',
	transform: 'translate(-50%, -50%)',
	zIndex: 2,
	pointerEvents: 'none',
	whiteSpace: 'nowrap',
};

const LOADING_TEXT_VARIANTS = {
	subtle: {
		size: 'xs' as const,
		style: {...loadingTextBase, color: 'var(--accent-text)'},
	},
	elegant: {
		c: 'white',
		size: 'sm' as const,
		fs: 'italic' as const,
		style: {
			...loadingTextBase,
			letterSpacing: '0.06em',
			opacity: 0.8,
			textShadow: '0 1px 4px rgba(0,0,0,0.5)',
		},
	},
	brand: {
		c: 'blue.4',
		size: 'xs' as const,
		fw: 600,
		tt: 'uppercase' as const,
		style: {...loadingTextBase, letterSpacing: '0.1em'},
	},
};

const downloadUrl = (bucket: string, key: string): string =>
	`/api/buckets/${encodeURIComponent(bucket)}/download?key=${encodeURIComponent(key)}`;

const sectionLabel: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 650,
	letterSpacing: '0.08em',
	color: 'var(--text-muted)',
	textTransform: 'uppercase',
	marginBottom: 8,
};

const metaBlock = (label: string, value: string) => (
	<div key={label} style={{marginBottom: 6}}>
		<Text size="xs" style={{color: 'var(--text-muted)', marginBottom: 1}}>
			{label}
		</Text>
		<Text size="xs" style={{wordBreak: 'break-all'}}>
			{value}
		</Text>
	</div>
);

interface InspectorRailProps {
	bucket: string;
	objectKey: string;
	size: number;
	lastModified: string;
	etag: string | undefined;
	contentType: string | undefined;
	onClose: () => void;
	onDeleteDone: (key: string) => void;
}

const InspectorRail = ({
	bucket,
	objectKey,
	size,
	lastModified,
	etag,
	contentType,
	onClose,
	onDeleteDone,
}: InspectorRailProps) => {
	const [deleteConfirm, setDeleteConfirm] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const filename = objectKey.split('/').pop() ?? objectKey;
	const directUrl = `${window.location.origin}${objectUrl(bucket, objectKey)}`;

	const confirmDelete = async () => {
		setDeleting(true);
		try {
			const url = `/api/buckets/${encodeURIComponent(bucket)}/object?key=${encodeURIComponent(objectKey)}`;
			const res = await fetch(url, {method: 'DELETE'});
			if (!res.ok) {
				throw new Error(`Delete failed: ${res.status}`);
			}
			onDeleteDone(objectKey);
		} catch (err) {
			notifications.show({
				title: 'Failed to delete',
				message: err instanceof Error ? err.message : 'Unknown error',
				color: 'red',
			});
		} finally {
			setDeleting(false);
			setDeleteConfirm(false);
		}
	};

	return (
		<div
			style={{
				width: 300,
				borderLeft: '1px solid var(--border-color)',
				background: 'var(--rail-bg)',
				display: 'flex',
				flexDirection: 'column',
				overflowY: 'auto',
				flexShrink: 0,
			}}
		>
			<Stack gap={0} style={{padding: '16px 16px'}}>
				{/* Header */}
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'flex-start',
						marginBottom: 14,
					}}
				>
					<Text
						size="sm"
						fw={600}
						style={{
							maxWidth: 180,
							wordBreak: 'break-word',
							fontFamily: 'var(--font-display)',
						}}
					>
						{filename}
					</Text>
					<ActionIcon
						variant="subtle"
						color="gray"
						size="sm"
						onClick={onClose}
						aria-label="Close inspector"
					>
						<IconX size={14} />
					</ActionIcon>
				</div>

				{/* FILE section */}
				<div style={{marginBottom: 14}}>
					<div style={sectionLabel}>File</div>
					{metaBlock('Size', formatSize(size))}
					{metaBlock('Modified', formatDate(lastModified))}
					{metaBlock('ETag', etag ?? '—')}
					{metaBlock('Content-Type', contentType ?? '—')}
				</div>

				{/* PATH section */}
				<div style={{marginBottom: 14}}>
					<div style={sectionLabel}>Path</div>
					<div
						style={{
							fontFamily: 'var(--font-mono)',
							fontSize: 11,
							background: 'var(--bg-surface)',
							border: '1px solid var(--border-color)',
							borderRadius: 4,
							padding: '6px 24px 6px 8px',
							wordBreak: 'break-all',
							color: 'var(--text-primary)',
							position: 'relative',
						}}
					>
						<span data-testid="path-block">{objectKey}</span>
						<CopyButton value={objectKey}>
							{({copied, copy}) => (
								<ActionIcon
									variant="subtle"
									color={copied ? 'green' : 'gray'}
									size="xs"
									onClick={copy}
									style={{position: 'absolute', top: 4, right: 4}}
									aria-label="Copy path"
								>
									<IconCopy size={11} />
								</ActionIcon>
							)}
						</CopyButton>
					</div>
				</div>

				{/* ACTIONS section */}
				<div>
					<div style={sectionLabel}>Actions</div>
					<Stack gap={4}>
						<CopyButton value={directUrl}>
							{({copied, copy}) => (
								<Button
									variant="subtle"
									size="xs"
									leftSection={<IconCopy size={12} />}
									onClick={copy}
									justify="flex-start"
									fullWidth
									color={copied ? ('kgreen' as const) : ('gray' as const)}
								>
									{copied ? 'Copied!' : 'Copy presigned link'}
								</Button>
							)}
						</CopyButton>

						<Button
							component="a"
							href={downloadUrl(bucket, objectKey)}
							download={filename}
							variant="subtle"
							size="xs"
							leftSection={<IconDownload size={12} />}
							justify="flex-start"
							fullWidth
							data-testid="download-btn"
						>
							Download original
						</Button>

						{!deleteConfirm ? (
							<Button
								variant="subtle"
								color="red"
								size="xs"
								leftSection={<IconTrash size={12} />}
								onClick={() => {
									setDeleteConfirm(true);
								}}
								justify="flex-start"
								fullWidth
							>
								Delete
							</Button>
						) : (
							<div
								style={{
									background: 'var(--bg-surface)',
									border: '1px solid var(--border-color)',
									borderRadius: 6,
									padding: '8px 10px',
								}}
							>
								<Text size="xs" mb={8}>
									Delete <strong>{filename}</strong>? This cannot be undone.
								</Text>
								<Group gap={6}>
									<Button
										size="xs"
										color="red"
										loading={deleting}
										onClick={() => {
											void confirmDelete();
										}}
									>
										Delete
									</Button>
									<Button
										size="xs"
										variant="default"
										disabled={deleting}
										onClick={() => {
											setDeleteConfirm(false);
										}}
									>
										Cancel
									</Button>
								</Group>
							</div>
						)}
					</Stack>
				</div>
			</Stack>
		</div>
	);
};

interface ObjectInspectorProps {
	bucket: string;
	objectKey: string;
	size: number;
	lastModified: string;
	etag: string | undefined;
	contentType: string | undefined;
	siblings: S3Object[];
	onClose: () => void;
	onDelete: (key: string) => void;
	onNavigate: (key: string) => void;
}

export const ObjectInspector = ({
	bucket,
	objectKey,
	size,
	lastModified,
	etag,
	contentType,
	siblings,
	onClose,
	onDelete,
	onNavigate,
}: ObjectInspectorProps) => {
	const {isMobile} = useMobile();
	const [imgLoaded, setImgLoaded] = useState(false);
	const isImage = isImageFile(objectKey);
	const filename = objectKey.split('/').pop() ?? objectKey;

	const imageSiblings = siblings.filter((s) => !s.isPrefix && isImageFile(s.key));
	const currentIdx = imageSiblings.findIndex((s) => s.key === objectKey);

	const railProps: InspectorRailProps = {
		bucket,
		objectKey,
		size,
		lastModified,
		etag,
		contentType,
		onClose,
		onDeleteDone: onDelete,
	};

	if (isMobile) {
		return (
			<MobileInspector
				bucket={bucket}
				objectKey={objectKey}
				size={size}
				lastModified={lastModified}
				contentType={contentType}
				filename={filename}
				isImage={isImage}
				imgLoaded={imgLoaded}
				imageSiblings={imageSiblings}
				currentIdx={currentIdx}
				onClose={onClose}
				onDelete={onDelete}
				onNavigate={onNavigate}
				onImgLoad={() => {
					setImgLoaded(true);
				}}
			/>
		);
	}

	if (isImage) {
		return (
			<div style={{display: 'flex', width: '100%', height: '100%'}}>
				{/* Image viewer + filmstrip */}
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						minWidth: 0,
						overflow: 'hidden',
					}}
				>
					<div
						style={{
							flex: 1,
							minHeight: 0,
							position: 'relative',
							background: 'var(--bg-base)',
							overflow: 'hidden',
						}}
					>
						{!imgLoaded && (
							<>
								<Skeleton
									style={{
										position: 'absolute',
										inset: 0,
										width: '100%',
										height: '100%',
										zIndex: 1,
									}}
								/>
								<Text {...LOADING_TEXT_VARIANTS[LOADING_TEXT_STYLE]}>
									kastor is purring...
								</Text>
							</>
						)}
						<img
							key={objectKey}
							src={objectUrl(bucket, objectKey)}
							alt={filename}
							style={{
								position: 'absolute',
								inset: 0,
								width: '100%',
								height: '100%',
								objectFit: 'contain',
							}}
							onLoad={() => {
								setImgLoaded(true);
							}}
							onError={() => {
								setImgLoaded(true);
							}}
						/>

						<ActionIcon
							variant="default"
							style={{
								position: 'absolute',
								left: 12,
								top: '50%',
								transform: 'translateY(-50%)',
							}}
							disabled={currentIdx <= 0}
							onClick={() => {
								const prev = imageSiblings[currentIdx - 1];
								if (prev !== undefined) {
									setImgLoaded(false);
									onNavigate(prev.key);
								}
							}}
							aria-label="Previous image"
						>
							<IconChevronLeft size={16} />
						</ActionIcon>

						<ActionIcon
							variant="default"
							style={{
								position: 'absolute',
								right: 12,
								top: '50%',
								transform: 'translateY(-50%)',
							}}
							disabled={currentIdx >= imageSiblings.length - 1}
							onClick={() => {
								const next = imageSiblings[currentIdx + 1];
								if (next !== undefined) {
									setImgLoaded(false);
									onNavigate(next.key);
								}
							}}
							aria-label="Next image"
						>
							<IconChevronRight size={16} />
						</ActionIcon>

						{imageSiblings.length > 1 && (
							<div
								style={{
									position: 'absolute',
									bottom: 12,
									left: '50%',
									transform: 'translateX(-50%)',
									background: 'rgba(0,0,0,0.55)',
									borderRadius: 20,
									padding: '3px 10px',
									fontSize: 11,
									color: 'rgba(255,255,255,0.8)',
									fontFeatureSettings: '"tnum"',
									pointerEvents: 'none',
								}}
							>
								{currentIdx + 1} / {imageSiblings.length}
							</div>
						)}
					</div>

					{/* Filmstrip */}
					{imageSiblings.length > 1 && (
						<div
							style={{
								display: 'flex',
								gap: 4,
								padding: '6px 12px',
								overflowX: 'auto',
								background: 'var(--bg-surface)',
								borderTop: '1px solid var(--border-color)',
								flexShrink: 0,
							}}
						>
							{imageSiblings.map((sib, i) => (
								<button
									key={sib.key}
									onClick={() => {
										if (i !== currentIdx) {
											setImgLoaded(false);
											onNavigate(sib.key);
										}
									}}
									style={{
										width: 56,
										height: 42,
										flexShrink: 0,
										border:
											i === currentIdx
												? '2px solid var(--accent)'
												: '2px solid transparent',
										borderRadius: 4,
										overflow: 'hidden',
										cursor: 'pointer',
										padding: 0,
										background: 'var(--bg-base)',
									}}
									aria-label={`Go to ${sib.key.split('/').pop()}`}
									aria-current={i === currentIdx ? true : undefined}
								>
									<img
										src={objectUrl(bucket, sib.key)}
										alt=""
										style={{
											width: '100%',
											height: '100%',
											objectFit: 'cover',
											display: 'block',
										}}
										loading="lazy"
									/>
								</button>
							))}
						</div>
					)}
				</div>

				<InspectorRail {...railProps} />
			</div>
		);
	}

	/* Non-image */
	return (
		<div style={{display: 'flex', flex: 1, minHeight: 0}}>
			<div
				style={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					background: 'var(--bg-base)',
					gap: 12,
				}}
			>
				<IconFile size={64} style={{color: 'var(--text-muted)'}} />
				<Text c="dimmed" size="sm">
					{filename}
				</Text>
			</div>
			<InspectorRail {...railProps} />
		</div>
	);
};

interface MobileInspectorProps {
	bucket: string;
	objectKey: string;
	size: number;
	lastModified: string;
	contentType: string | undefined;
	filename: string;
	isImage: boolean;
	imgLoaded: boolean;
	imageSiblings: S3Object[];
	currentIdx: number;
	onClose: () => void;
	onDelete: (key: string) => void;
	onNavigate: (key: string) => void;
	onImgLoad: () => void;
}

const MobileInspector = ({
	bucket,
	objectKey,
	size,
	lastModified,
	contentType,
	filename,
	isImage,
	imgLoaded,
	imageSiblings,
	currentIdx,
	onClose,
	onDelete,
	onNavigate,
	onImgLoad,
}: MobileInspectorProps) => {
	const [deleteConfirm, setDeleteConfirm] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const directUrl = `${window.location.origin}${objectUrl(bucket, objectKey)}`;

	const goToPrev = () => {
		const prev = imageSiblings[currentIdx - 1];
		if (prev !== undefined) {
			onNavigate(prev.key);
		}
	};

	const goToNext = () => {
		const next = imageSiblings[currentIdx + 1];
		if (next !== undefined) {
			onNavigate(next.key);
		}
	};

	const swipeHandlers = useSwipe({
		onSwipeLeft: currentIdx < imageSiblings.length - 1 ? goToNext : undefined,
		onSwipeRight: currentIdx > 0 ? goToPrev : undefined,
	});

	const confirmDelete = async () => {
		setDeleting(true);
		try {
			const url = `/api/buckets/${encodeURIComponent(bucket)}/object?key=${encodeURIComponent(objectKey)}`;
			const res = await fetch(url, {method: 'DELETE'});
			if (!res.ok) {
				throw new Error(`Delete failed: ${res.status}`);
			}
			onDelete(objectKey);
		} catch (err) {
			notifications.show({
				title: 'Failed to delete',
				message: err instanceof Error ? err.message : 'Unknown error',
				color: 'red',
			});
		} finally {
			setDeleting(false);
			setDeleteConfirm(false);
		}
	};

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				width: '100%',
				height: '100%',
				background: isImage ? '#000' : 'var(--bg-base)',
			}}
		>
			{/* Mobile header */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 8,
					padding: '0 8px 0 4px',
					height: 56,
					borderBottom: '1px solid rgba(255,255,255,0.08)',
					background: isImage ? 'rgba(0,0,0,0.7)' : 'var(--bg-base)',
					flexShrink: 0,
					zIndex: 1,
				}}
			>
				<button
					onClick={onClose}
					aria-label="Back to file list"
					style={{
						background: 'none',
						border: 'none',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						minWidth: 44,
						minHeight: 44,
						color: isImage ? 'rgba(255,255,255,0.9)' : 'var(--accent-text)',
						flexShrink: 0,
					}}
				>
					<IconChevronLeft size={22} />
				</button>
				<Text
					fw={500}
					truncate
					style={{
						flex: 1,
						fontFamily: 'var(--font-display)',
						fontSize: 15,
						color: isImage ? 'rgba(255,255,255,0.9)' : 'var(--text-primary)',
					}}
				>
					{filename}
				</Text>
			</div>

			{/* Content area */}
			{isImage ? (
				<div
					style={{
						flex: 1,
						position: 'relative',
						overflow: 'hidden',
						minHeight: 0,
					}}
					{...swipeHandlers}
				>
					{!imgLoaded && (
						<>
							<Skeleton
								style={{
									position: 'absolute',
									inset: 0,
									width: '100%',
									height: '100%',
									zIndex: 1,
									background: '#1a1a1a',
								}}
							/>
							<Text
								{...LOADING_TEXT_VARIANTS[LOADING_TEXT_STYLE]}
								style={{
									...loadingTextBase,
									color: 'rgba(255,255,255,0.5)',
								}}
							>
								kastor is purring...
							</Text>
						</>
					)}
					<img
						key={objectKey}
						src={objectUrl(bucket, objectKey)}
						alt={filename}
						style={{
							position: 'absolute',
							inset: 0,
							width: '100%',
							height: '100%',
							objectFit: 'contain',
						}}
						onLoad={onImgLoad}
						onError={onImgLoad}
					/>

					{/* Prev/Next buttons */}
					{currentIdx > 0 && (
						<button
							onClick={goToPrev}
							aria-label="Previous image"
							style={{
								position: 'absolute',
								left: 12,
								top: '50%',
								transform: 'translateY(-50%)',
								width: 48,
								height: 48,
								borderRadius: 24,
								background: 'rgba(0,0,0,0.5)',
								border: 'none',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: '#fff',
							}}
						>
							<IconChevronLeft size={22} />
						</button>
					)}
					{currentIdx < imageSiblings.length - 1 && (
						<button
							onClick={goToNext}
							aria-label="Next image"
							style={{
								position: 'absolute',
								right: 12,
								top: '50%',
								transform: 'translateY(-50%)',
								width: 48,
								height: 48,
								borderRadius: 24,
								background: 'rgba(0,0,0,0.5)',
								border: 'none',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: '#fff',
							}}
						>
							<IconChevronRight size={22} />
						</button>
					)}
				</div>
			) : (
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 12,
					}}
				>
					<IconFile size={64} style={{color: 'var(--text-muted)'}} />
					<Text c="dimmed" size="sm">
						{filename}
					</Text>
				</div>
			)}

			{/* Peek sheet */}
			<div
				style={{
					background: isImage ? 'rgba(10,10,10,0.95)' : 'var(--bg-surface)',
					borderTop: '1px solid rgba(255,255,255,0.08)',
					flexShrink: 0,
				}}
			>
				{/* Metadata row */}
				<div
					style={{
						display: 'flex',
						borderBottom: '1px solid rgba(255,255,255,0.06)',
					}}
				>
					<div
						style={{
							flex: 1,
							padding: '10px 16px',
							borderRight: '1px solid rgba(255,255,255,0.06)',
						}}
					>
						<Text
							style={{
								fontSize: 10,
								fontWeight: 650,
								letterSpacing: '0.08em',
								textTransform: 'uppercase',
								color: 'rgba(255,255,255,0.4)',
								marginBottom: 3,
							}}
						>
							Size
						</Text>
						<Text
							style={{
								fontSize: 13,
								color: isImage ? 'rgba(255,255,255,0.85)' : 'var(--text-primary)',
								fontFeatureSettings: '"tnum"',
							}}
						>
							{formatSize(size)}
						</Text>
					</div>
					<div
						style={{
							flex: 1,
							padding: '10px 16px',
							borderRight: '1px solid rgba(255,255,255,0.06)',
						}}
					>
						<Text
							style={{
								fontSize: 10,
								fontWeight: 650,
								letterSpacing: '0.08em',
								textTransform: 'uppercase',
								color: 'rgba(255,255,255,0.4)',
								marginBottom: 3,
							}}
						>
							Type
						</Text>
						<Text
							style={{
								fontSize: 13,
								color: isImage ? 'rgba(255,255,255,0.85)' : 'var(--text-primary)',
							}}
						>
							{contentType?.split('/')[1]?.toUpperCase() ??
								filename.split('.').pop()?.toUpperCase() ??
								'—'}
						</Text>
					</div>
					<div style={{flex: 1, padding: '10px 16px'}}>
						<Text
							style={{
								fontSize: 10,
								fontWeight: 650,
								letterSpacing: '0.08em',
								textTransform: 'uppercase',
								color: 'rgba(255,255,255,0.4)',
								marginBottom: 3,
							}}
						>
							Modified
						</Text>
						<Text
							style={{
								fontSize: 13,
								color: isImage ? 'rgba(255,255,255,0.85)' : 'var(--text-primary)',
								fontFeatureSettings: '"tnum"',
							}}
						>
							{lastModified !== '' ? formatDate(lastModified) : '—'}
						</Text>
					</div>
				</div>

				{/* Action bar */}
				{!deleteConfirm ? (
					<div
						style={{
							display: 'flex',
							height: 56,
							paddingBottom: 'env(safe-area-inset-bottom)',
						}}
					>
						<CopyButton value={directUrl}>
							{({copied, copy}) => (
								<button
									onClick={copy}
									style={{
										flex: 1,
										background: 'none',
										border: 'none',
										borderRight: '1px solid rgba(255,255,255,0.06)',
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										gap: 6,
										color: copied
											? 'var(--accent-text)'
											: isImage
												? 'rgba(255,255,255,0.8)'
												: 'var(--text-primary)',
										fontSize: 14,
									}}
								>
									<IconCopy size={16} />
									{copied ? 'Copied!' : 'Copy link'}
								</button>
							)}
						</CopyButton>
						<a
							href={downloadUrl(bucket, objectKey)}
							download={filename}
							data-testid="download-btn"
							style={{
								flex: 1,
								background: 'var(--accent)',
								border: 'none',
								borderRight: '1px solid rgba(255,255,255,0.06)',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: 6,
								color: '#fff',
								fontSize: 14,
								textDecoration: 'none',
								fontWeight: 500,
							}}
						>
							<IconDownload size={16} />
							Download
						</a>
						<button
							onClick={() => {
								setDeleteConfirm(true);
							}}
							aria-label="Delete file"
							style={{
								width: 56,
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: 'var(--danger)',
							}}
						>
							<IconTrash size={18} />
						</button>
					</div>
				) : (
					<div
						style={{
							padding: '10px 16px',
							paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
						}}
					>
						<Text
							style={{
								fontSize: 13,
								color: isImage ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
								marginBottom: 10,
							}}
						>
							Delete{' '}
							<strong style={{color: isImage ? '#fff' : 'var(--text-primary)'}}>
								{filename}
							</strong>
							? This cannot be undone.
						</Text>
						<div style={{display: 'flex', gap: 8}}>
							<Button
								color="red"
								size="sm"
								loading={deleting}
								onClick={() => {
									void confirmDelete();
								}}
								style={{flex: 1}}
							>
								Delete
							</Button>
							<Button
								variant="default"
								size="sm"
								disabled={deleting}
								onClick={() => {
									setDeleteConfirm(false);
								}}
								style={{flex: 1}}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
