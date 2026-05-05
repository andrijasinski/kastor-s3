import {useRef} from 'react';
import {useMatch, useNavigate} from 'react-router-dom';
import {Progress, Text, UnstyledButton} from '@mantine/core';
import {IconFolder, IconX} from '@tabler/icons-react';
import {useBuckets} from '../contexts/BucketsContext';
import {MobileProvider, useMobile} from '../contexts/MobileContext';
import {formatSize} from '../utils/format';

const sectionLabel: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 650,
	letterSpacing: '0.09em',
	textTransform: 'uppercase',
	color: 'var(--text-muted)',
	padding: '18px 18px 6px',
};

const RailContent = ({onBucketClick}: {onBucketClick?: () => void}) => {
	const {buckets, statsMap} = useBuckets();
	const navigate = useNavigate();
	const match = useMatch('/buckets/:bucket/*');
	const activeBucket = match?.params['bucket'] ?? null;
	const activeBucketStats = activeBucket !== null ? statsMap.get(activeBucket) : undefined;

	const displayObjects =
		activeBucketStats !== undefined
			? activeBucketStats.objectCount
			: buckets.reduce((sum, b) => sum + (statsMap.get(b.name)?.objectCount ?? 0), 0);
	const displaySize =
		activeBucketStats !== undefined
			? activeBucketStats.totalSize
			: buckets.reduce((sum, b) => sum + (statsMap.get(b.name)?.totalSize ?? 0), 0);
	const displayLabel =
		activeBucket !== null
			? activeBucket
			: `${buckets.length} ${buckets.length === 1 ? 'bucket' : 'buckets'}`;

	const formatCount = (n: number): string => {
		if (n >= 1_000_000) {
			return `${(n / 1_000_000).toFixed(1)}m`;
		}
		if (n >= 1000) {
			return `${(n / 1000).toFixed(1)}k`;
		}
		return n.toString();
	};

	return (
		<>
			{/* Buckets */}
			<div style={sectionLabel}>Buckets</div>
			<div>
				{buckets.map((b) => {
					const stats = statsMap.get(b.name);
					const count = stats !== undefined ? formatCount(stats.objectCount) : '…';
					const isActive = b.name === activeBucket;
					return (
						<UnstyledButton
							key={b.name}
							onClick={() => {
								void navigate(`/buckets/${encodeURIComponent(b.name)}`);
								onBucketClick?.();
							}}
							aria-label={`Go to bucket ${b.name}`}
							aria-current={isActive ? 'page' : undefined}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								width: '100%',
								padding: '9px 14px 9px 16px',
								borderLeft: isActive
									? '2px solid var(--accent)'
									: '2px solid transparent',
								background: isActive ? 'var(--accent-dim)' : 'transparent',
								gap: 6,
								minHeight: 44,
							}}
						>
							<div
								style={{display: 'flex', alignItems: 'center', gap: 7, minWidth: 0}}
							>
								<IconFolder
									size={15}
									style={{
										color: isActive
											? 'var(--accent-text)'
											: 'var(--text-muted)',
										flexShrink: 0,
									}}
								/>
								<Text
									truncate
									style={{
										fontSize: 14,
										color: isActive
											? 'var(--accent-text)'
											: 'var(--text-primary)',
										fontWeight: isActive ? 500 : 400,
									}}
								>
									{b.name}
								</Text>
							</div>
							<Text
								style={{
									fontSize: 13,
									color: 'var(--text-muted)',
									flexShrink: 0,
									fontFeatureSettings: '"tnum"',
								}}
							>
								{count}
							</Text>
						</UnstyledButton>
					);
				})}
			</div>

			{/* Storage */}
			<div style={{marginTop: 20}}>
				<div style={sectionLabel}>Storage</div>
				<div style={{padding: '8px 18px 14px'}}>
					<Text
						fw={700}
						style={{
							fontFamily: 'var(--font-display)',
							fontSize: 30,
							letterSpacing: '-0.02em',
							color: 'var(--text-primary)',
							lineHeight: 1.1,
							fontFeatureSettings: '"tnum"',
						}}
					>
						{formatSize(displaySize)}
					</Text>
					<Text
						style={{
							fontSize: 13,
							color: 'var(--text-muted)',
							marginTop: 4,
							fontFeatureSettings: '"tnum"',
						}}
					>
						{displayObjects.toLocaleString()} objects · {displayLabel}
					</Text>
					<Progress
						value={
							displaySize > 0 ? Math.min(100, (displaySize / 1099511627776) * 100) : 0
						}
						size={3}
						color="kgreen"
						mt={10}
						styles={{root: {background: 'var(--border-strong)'}}}
					/>
				</div>
			</div>

			<div style={{flex: 1}} />
		</>
	);
};

const MobileDrawer = () => {
	const {drawerOpen, closeDrawer} = useMobile();
	const navigate = useNavigate();

	if (!drawerOpen) {
		return null;
	}

	return (
		<>
			{/* Scrim */}
			<div
				aria-hidden="true"
				onClick={closeDrawer}
				style={{
					position: 'fixed',
					inset: 0,
					zIndex: 200,
					background: 'rgba(0,0,0,0.6)',
				}}
			/>
			{/* Drawer panel */}
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Navigation drawer"
				style={{
					position: 'fixed',
					top: 0,
					left: 0,
					bottom: 0,
					width: 280,
					zIndex: 201,
					background: 'var(--rail-bg)',
					borderRight: '1px solid var(--border-color)',
					display: 'flex',
					flexDirection: 'column',
					overflowY: 'auto',
				}}
			>
				{/* Drawer header */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '16px 16px 16px 18px',
						borderBottom: '1px solid var(--border-color)',
					}}
				>
					<UnstyledButton
						onClick={() => {
							void navigate('/');
							closeDrawer();
						}}
						style={{display: 'flex', alignItems: 'center', gap: 10}}
					>
						<img
							src="/logo.png"
							alt="kastor"
							width={28}
							height={28}
							style={{borderRadius: 4, flexShrink: 0}}
						/>
						<Text
							fw={650}
							style={{
								fontFamily: 'var(--font-display)',
								fontSize: 17,
								letterSpacing: '-0.02em',
								color: 'var(--text-primary)',
								lineHeight: 1,
							}}
						>
							kastor
						</Text>
					</UnstyledButton>
					<UnstyledButton
						onClick={closeDrawer}
						aria-label="Close drawer"
						style={{
							color: 'var(--text-muted)',
							display: 'flex',
							alignItems: 'center',
							padding: 8,
						}}
					>
						<IconX size={18} />
					</UnstyledButton>
				</div>

				<RailContent onBucketClick={closeDrawer} />
			</div>
		</>
	);
};

interface AppShellProps {
	children: React.ReactNode;
}

const AppShellInner = ({children}: AppShellProps) => {
	const {isMobile} = useMobile();
	const navigate = useNavigate();

	if (isMobile) {
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					height: '100vh',
					background: 'var(--bg-base)',
				}}
			>
				<MobileDrawer />
				<main
					style={{
						flex: 1,
						minHeight: 0,
						display: 'flex',
						flexDirection: 'column',
						overflow: 'hidden',
					}}
				>
					{children}
				</main>
			</div>
		);
	}

	return (
		<div style={{display: 'flex', height: '100vh', background: 'var(--bg-base)'}}>
			{/* Left rail */}
			<nav
				aria-label="Sidebar"
				style={{
					width: 'var(--rail-width)',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					background: 'var(--rail-bg)',
					borderRight: '1px solid var(--border-color)',
					flexShrink: 0,
					overflowY: 'auto',
				}}
			>
				{/* Wordmark */}
				<UnstyledButton
					onClick={() => {
						void navigate('/');
					}}
					style={{
						padding: '18px 18px 16px',
						display: 'flex',
						alignItems: 'center',
						gap: 10,
					}}
				>
					<img
						src="/logo.png"
						alt="kastor"
						width={34}
						height={34}
						style={{borderRadius: 5, flexShrink: 0}}
					/>
					<Text
						fw={650}
						style={{
							fontFamily: 'var(--font-display)',
							fontSize: 18,
							letterSpacing: '-0.02em',
							color: 'var(--text-primary)',
							lineHeight: 1,
						}}
					>
						kastor
					</Text>
				</UnstyledButton>

				<RailContent />
			</nav>

			{/* Main content */}
			<main
				style={{
					flex: 1,
					minWidth: 0,
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
				}}
			>
				{children}
			</main>
		</div>
	);
};

export const AppShell = ({children}: AppShellProps) => {
	const containerRef = useRef<HTMLDivElement>(null);

	return (
		<div ref={containerRef} style={{height: '100vh'}}>
			<MobileProvider containerRef={containerRef}>
				<AppShellInner>{children}</AppShellInner>
			</MobileProvider>
		</div>
	);
};
