import {createContext, useCallback, useContext, useEffect, useState} from 'react';

interface MobileContextValue {
	isMobile: boolean;
	drawerOpen: boolean;
	openDrawer: () => void;
	closeDrawer: () => void;
}

const MobileContext = createContext<MobileContextValue>({
	isMobile: false,
	drawerOpen: false,
	openDrawer: () => {},
	closeDrawer: () => {},
});

export const useMobile = () => useContext(MobileContext);

export const MobileProvider = ({
	containerRef,
	children,
}: {
	containerRef: React.RefObject<HTMLDivElement | null>;
	children: React.ReactNode;
}) => {
	const [isMobile, setIsMobile] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);

	useEffect(() => {
		const el = containerRef.current;
		if (el === null) {
			return;
		}
		const observer = new ResizeObserver(([entry]) => {
			if (entry !== undefined) {
				setIsMobile(entry.contentRect.width <= 640);
			}
		});
		observer.observe(el);
		return () => {
			observer.disconnect();
		};
	}, [containerRef]);

	const openDrawer = useCallback(() => {
		setDrawerOpen(true);
	}, []);
	const closeDrawer = useCallback(() => {
		setDrawerOpen(false);
	}, []);

	return (
		<MobileContext.Provider value={{isMobile, drawerOpen, openDrawer, closeDrawer}}>
			{children}
		</MobileContext.Provider>
	);
};
