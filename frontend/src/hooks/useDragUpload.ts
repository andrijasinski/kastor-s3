import {useCallback, useRef, useState} from 'react';
import {resolveDropEntries} from '../utils/resolveDropEntries';
import type {ResolvedFile} from '../utils/resolveDropEntries';

interface UseDragUploadOptions {
	disabled: boolean;
	onDrop: (files: ResolvedFile[]) => void;
}

export interface DragProps {
	onDragEnter: React.DragEventHandler<HTMLDivElement>;
	onDragOver: React.DragEventHandler<HTMLDivElement>;
	onDragLeave: React.DragEventHandler<HTMLDivElement>;
	onDrop: React.DragEventHandler<HTMLDivElement>;
}

export interface UseDragUploadResult {
	isDragging: boolean;
	dragProps: DragProps;
}

export const useDragUpload = ({disabled, onDrop}: UseDragUploadOptions): UseDragUploadResult => {
	const [dragCounter, setDragCounter] = useState(0);
	const disabledRef = useRef(disabled);
	disabledRef.current = disabled;
	const onDropRef = useRef(onDrop);
	onDropRef.current = onDrop;

	const handleDragEnter = useCallback<React.DragEventHandler<HTMLDivElement>>((e) => {
		if (disabledRef.current) {
			return;
		}
		e.preventDefault();
		setDragCounter((c) => c + 1);
	}, []);

	const handleDragOver = useCallback<React.DragEventHandler<HTMLDivElement>>((e) => {
		if (disabledRef.current) {
			return;
		}
		e.preventDefault();
	}, []);

	const handleDragLeave = useCallback<React.DragEventHandler<HTMLDivElement>>((e) => {
		if (disabledRef.current) {
			return;
		}
		e.preventDefault();
		setDragCounter((c) => Math.max(0, c - 1));
	}, []);

	const handleDrop = useCallback<React.DragEventHandler<HTMLDivElement>>((e) => {
		if (disabledRef.current) {
			return;
		}
		e.preventDefault();
		setDragCounter(0);
		void resolveDropEntries(e.dataTransfer.items)
			.then((files) => {
				onDropRef.current(files);
			})
			.catch(() => {
				// FileSystem API errors are rare; silently ignore to avoid unhandled rejection
			});
	}, []);

	return {
		isDragging: !disabled && dragCounter > 0,
		dragProps: {
			onDragEnter: handleDragEnter,
			onDragOver: handleDragOver,
			onDragLeave: handleDragLeave,
			onDrop: handleDrop,
		},
	};
};
