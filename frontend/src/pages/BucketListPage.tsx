import {useNavigate} from 'react-router-dom';
import {Progress, Skeleton, Text, UnstyledButton} from '@mantine/core';
import {IconFolder, IconMenu2} from '@tabler/icons-react';
import type {Bucket, BucketStats} from '@shared/types';
import {useBuckets} from '../contexts/BucketsContext';
import {useMobile} from '../contexts/MobileContext';
import {formatDate, formatSize} from '../utils/format';

interface BucketCardProps {
	bucket: Bucket;
	stats: BucketStats | undefined;
	statsLoading: boolean;
	onClick: () => void;
}

const statLabel: React.CSSProperties = {
	fontSize: 12,
	fontWeight: 650,
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
	color: 'var(--text-muted)',
	marginBottom: 6,
};

const statValue: React.CSSProperties = {
	fontSize: 32,
	fontWeight: 700,
	letterSpacing: '-0.02em',
	color: 'var(--text-primary)',
	fontFeatureSettings: '"tnum"',
	lineHeight: 1,
};

const DesktopBucketCard = ({bucket, stats, statsLoading, onClick}: BucketCardProps) => (
	<button
		onClick={onClick}
		aria-label={`Open bucket ${bucket.name}`}
		style={{
			background: 'var(--bg-surface)',
			border: '1px solid var(--border-color)',
			borderRadius: 12,
			padding: '24px 28px',
			cursor: 'pointer',
			textAlign: 'left',
			width: '100%',
			transition: 'border-color 0.15s, background 0.15s',
		}}
		onMouseEnter={(e) => {
			(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
			(e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
		}}
		onMouseLeave={(e) => {
			(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
			(e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
		}}
	>
		{/* Top row */}
		<div
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'flex-start',
				marginBottom: 8,
			}}
		>
			<div style={{display: 'flex', alignItems: 'center', gap: 9, minWidth: 0}}>
				<IconFolder size={18} style={{color: 'var(--accent-text)', flexShrink: 0}} />
				<Text
					fw={600}
					style={{
						fontSize: 17,
						color: 'var(--text-primary)',
						wordBreak: 'break-all',
						letterSpacing: '-0.01em',
					}}
				>
					{bucket.name}
				</Text>
			</div>
			<span
				style={{
					fontSize: 14,
					color: 'var(--accent-text)',
					flexShrink: 0,
					marginLeft: 14,
					fontWeight: 500,
				}}
			>
				Open →
			</span>
		</div>

		{/* Region + date */}
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 8,
				marginBottom: 20,
				flexWrap: 'wrap',
			}}
		>
			{bucket.region !== '' && (
				<span
					style={{
						fontSize: 13,
						color: 'var(--text-muted)',
						background: 'rgba(242,255,244,0.04)',
						border: '1px solid var(--border-color)',
						borderRadius: 4,
						padding: '2px 7px',
					}}
				>
					{bucket.region}
				</span>
			)}
			<Text style={{fontSize: 13, color: 'var(--text-muted)'}}>
				Created {formatDate(bucket.creationDate)}
			</Text>
		</div>

		{/* Stats */}
		<div style={{display: 'flex', gap: 40}}>
			<div>
				<div style={statLabel}>Objects</div>
				{statsLoading ? (
					<Skeleton height={30} width={56} />
				) : (
					<div style={statValue}>
						{stats !== undefined ? stats.objectCount.toLocaleString() : '—'}
					</div>
				)}
			</div>
			<div>
				<div style={statLabel}>Size</div>
				{statsLoading ? (
					<Skeleton height={30} width={72} />
				) : (
					<div style={statValue}>
						{stats !== undefined ? formatSize(stats.totalSize) : '—'}
					</div>
				)}
			</div>
		</div>
	</button>
);

const MobileBucketRow = ({bucket, stats, statsLoading, onClick}: BucketCardProps) => (
	<UnstyledButton
		onClick={onClick}
		aria-label={`Open bucket ${bucket.name}`}
		style={{
			display: 'flex',
			alignItems: 'center',
			gap: 12,
			padding: '14px 16px',
			background: 'var(--bg-surface)',
			border: '1px solid var(--border-color)',
			borderRadius: 10,
			width: '100%',
			minHeight: 56,
		}}
	>
		<div
			style={{
				width: 40,
				height: 40,
				borderRadius: 8,
				background: 'var(--accent-dim)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				flexShrink: 0,
			}}
		>
			<IconFolder size={20} style={{color: 'var(--accent-text)'}} />
		</div>
		<div style={{flex: 1, minWidth: 0}}>
			<Text
				fw={600}
				truncate
				style={{fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.3}}
			>
				{bucket.name}
			</Text>
			<Text style={{fontSize: 13, color: 'var(--text-muted)', marginTop: 2}}>
				{statsLoading
					? '…'
					: stats !== undefined
						? `${stats.objectCount.toLocaleString()} objects · ${formatSize(stats.totalSize)}`
						: '—'}
			</Text>
		</div>
		<span style={{color: 'var(--text-muted)', fontSize: 18, flexShrink: 0}}>›</span>
	</UnstyledButton>
);

const MobileBucketListPage = () => {
	const navigate = useNavigate();
	const {buckets, statsMap, bucketsLoading} = useBuckets();
	const {openDrawer} = useMobile();

	const totalObjects = buckets.reduce(
		(sum, b) => sum + (statsMap.get(b.name)?.objectCount ?? 0),
		0,
	);
	const totalSize = buckets.reduce((sum, b) => sum + (statsMap.get(b.name)?.totalSize ?? 0), 0);

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				background: 'var(--bg-base)',
			}}
		>
			{/* Mobile top header */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '0 16px',
					height: 56,
					borderBottom: '1px solid var(--border-color)',
					background: 'var(--bg-base)',
					flexShrink: 0,
				}}
			>
				<UnstyledButton
					onClick={openDrawer}
					aria-label="Open navigation drawer"
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						minWidth: 44,
						minHeight: 44,
						color: 'var(--text-primary)',
					}}
				>
					<IconMenu2 size={22} />
				</UnstyledButton>
				<Text
					fw={650}
					style={{
						fontFamily: 'var(--font-display)',
						fontSize: 18,
						letterSpacing: '-0.02em',
						color: 'var(--text-primary)',
					}}
				>
					kastor
				</Text>
				<div style={{width: 44}} />
			</div>

			{/* Scrollable content */}
			<div style={{flex: 1, overflowY: 'auto', padding: '16px 16px 24px'}}>
				{/* Storage card */}
				<div
					style={{
						background: 'var(--bg-surface)',
						border: '1px solid var(--border-color)',
						borderRadius: 12,
						padding: '16px 20px',
						marginBottom: 24,
					}}
				>
					<Text
						style={{
							fontSize: 11,
							fontWeight: 650,
							letterSpacing: '0.09em',
							textTransform: 'uppercase',
							color: 'var(--accent-text)',
							marginBottom: 8,
						}}
					>
						Storage
					</Text>
					<Text
						fw={700}
						style={{
							fontFamily: 'var(--font-display)',
							fontSize: 36,
							letterSpacing: '-0.02em',
							color: 'var(--text-primary)',
							lineHeight: 1,
							fontFeatureSettings: '"tnum"',
						}}
					>
						{formatSize(totalSize)}
					</Text>
					<Text
						style={{
							fontSize: 13,
							color: 'var(--text-muted)',
							marginTop: 4,
							fontFeatureSettings: '"tnum"',
						}}
					>
						{totalObjects.toLocaleString()} objects · {buckets.length}{' '}
						{buckets.length === 1 ? 'bucket' : 'buckets'}
					</Text>
					<Progress
						value={totalSize > 0 ? Math.min(100, (totalSize / 1099511627776) * 100) : 0}
						size={3}
						color="kgreen"
						mt={12}
						styles={{root: {background: 'var(--border-strong)'}}}
					/>
				</div>

				{/* Buckets section */}
				<Text
					style={{
						fontSize: 11,
						fontWeight: 650,
						letterSpacing: '0.09em',
						textTransform: 'uppercase',
						color: 'var(--text-muted)',
						marginBottom: 12,
					}}
				>
					Buckets
				</Text>

				{bucketsLoading ? (
					<div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
						{[1, 2, 3].map((n) => (
							<Skeleton key={n} height={72} radius={10} />
						))}
					</div>
				) : buckets.length === 0 ? (
					<div style={{padding: '60px 0', textAlign: 'center'}}>
						<IconFolder
							size={48}
							style={{color: 'var(--text-muted)', marginBottom: 12}}
						/>
						<Text style={{color: 'var(--text-muted)', fontSize: 15}}>
							No buckets found
						</Text>
					</div>
				) : (
					<div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
						{buckets.map((bucket) => (
							<MobileBucketRow
								key={bucket.name}
								bucket={bucket}
								stats={statsMap.get(bucket.name)}
								statsLoading={!statsMap.has(bucket.name)}
								onClick={() => {
									void navigate(`/buckets/${encodeURIComponent(bucket.name)}`);
								}}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export const BucketListPage = () => {
	const navigate = useNavigate();
	const {buckets, statsMap, bucketsLoading} = useBuckets();
	const {isMobile} = useMobile();

	if (isMobile) {
		return <MobileBucketListPage />;
	}

	if (bucketsLoading) {
		return (
			<div style={{padding: '40px 36px', overflowY: 'auto', flex: 1}}>
				<Text
					fw={650}
					style={{
						fontSize: 34,
						letterSpacing: '-0.02em',
						color: 'var(--text-primary)',
						marginBottom: 8,
					}}
				>
					Buckets
				</Text>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(2, 1fr)',
						gap: 18,
						marginTop: 24,
					}}
				>
					{[1, 2, 3].map((n) => (
						<Skeleton key={n} height={190} radius={12} />
					))}
				</div>
			</div>
		);
	}

	const totalObjects = buckets.reduce(
		(sum, b) => sum + (statsMap.get(b.name)?.objectCount ?? 0),
		0,
	);
	const totalSize = buckets.reduce((sum, b) => sum + (statsMap.get(b.name)?.totalSize ?? 0), 0);

	return (
		<div style={{padding: '40px 36px', maxWidth: 1000, overflowY: 'auto', flex: 1}}>
			{/* Header */}
			<h1
				style={{
					margin: '0 0 8px',
					fontSize: 34,
					fontWeight: 650,
					letterSpacing: '-0.02em',
					color: 'var(--text-primary)',
					fontFamily: 'var(--font-display)',
				}}
			>
				Buckets
			</h1>
			<p
				style={{
					margin: '0 0 32px',
					fontSize: 15,
					color: 'var(--text-muted)',
					fontFeatureSettings: '"tnum"',
				}}
			>
				{buckets.length} {buckets.length === 1 ? 'bucket' : 'buckets'} ·{' '}
				{totalObjects.toLocaleString()} objects · {formatSize(totalSize)} stored
			</p>

			{buckets.length === 0 ? (
				<div style={{padding: '80px 0', textAlign: 'center'}}>
					<IconFolder size={56} style={{color: 'var(--text-muted)', marginBottom: 16}} />
					<Text style={{color: 'var(--text-muted)', fontSize: 15}}>No buckets found</Text>
				</div>
			) : (
				<>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(2, 1fr)',
							gap: 18,
						}}
					>
						{buckets.map((bucket) => (
							<DesktopBucketCard
								key={bucket.name}
								bucket={bucket}
								stats={statsMap.get(bucket.name)}
								statsLoading={!statsMap.has(bucket.name)}
								onClick={() => {
									void navigate(`/buckets/${encodeURIComponent(bucket.name)}`);
								}}
							/>
						))}
					</div>
				</>
			)}
		</div>
	);
};
