import {useCallback, useRef} from 'react';

interface UseSwipeOptions {
	onSwipeLeft?: (() => void) | undefined;
	onSwipeRight?: (() => void) | undefined;
	threshold?: number;
}

export const useSwipe = ({onSwipeLeft, onSwipeRight, threshold = 50}: UseSwipeOptions) => {
	const startX = useRef<number | null>(null);

	const onTouchStart = useCallback((e: React.TouchEvent) => {
		startX.current = e.touches[0]?.clientX ?? null;
	}, []);

	const onTouchEnd = useCallback(
		(e: React.TouchEvent) => {
			if (startX.current === null) {
				return;
			}
			const endX = e.changedTouches[0]?.clientX ?? startX.current;
			const delta = endX - startX.current;
			startX.current = null;
			if (delta < -threshold) {
				onSwipeLeft?.();
			} else if (delta > threshold) {
				onSwipeRight?.();
			}
		},
		[onSwipeLeft, onSwipeRight, threshold],
	);

	return {onTouchStart, onTouchEnd};
};
