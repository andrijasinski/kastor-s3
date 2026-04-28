interface DragOverlayProps {
	show: boolean;
}

export const DragOverlay = ({show}: DragOverlayProps) => {
	if (!show) {
		return null;
	}

	return (
		<div
			aria-label="Drop to upload"
			style={{
				position: 'absolute',
				inset: 0,
				zIndex: 50,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'rgba(0, 0, 0, 0.55)',
				pointerEvents: 'none',
			}}
		>
			<span
				style={{
					fontSize: 20,
					fontWeight: 600,
					color: 'var(--accent-text, #4ade80)',
					userSelect: 'none',
				}}
			>
				Drop to upload
			</span>
		</div>
	);
};
