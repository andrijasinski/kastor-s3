import {act, renderHook} from '@testing-library/react';
import {vi, describe, it, expect, beforeEach} from 'vitest';
import {useDragUpload} from '../hooks/useDragUpload';

vi.mock('../utils/resolveDropEntries', () => ({
	resolveDropEntries: vi.fn(),
}));

import * as resolveDropEntriesModule from '../utils/resolveDropEntries';

const makeDragEvent = (): React.DragEvent<HTMLDivElement> =>
	({
		preventDefault: vi.fn(),
		dataTransfer: {items: {} as DataTransferItemList},
	}) as unknown as React.DragEvent<HTMLDivElement>;

describe('useDragUpload', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('isDragging becomes true on dragenter', () => {
		const {result} = renderHook(() => useDragUpload({disabled: false, onDrop: vi.fn()}));

		act(() => {
			result.current.dragProps.onDragEnter(makeDragEvent());
		});

		expect(result.current.isDragging).toBe(true);
	});

	it('isDragging reverts to false after matching number of dragleave events', () => {
		const {result} = renderHook(() => useDragUpload({disabled: false, onDrop: vi.fn()}));

		act(() => {
			result.current.dragProps.onDragEnter(makeDragEvent());
			result.current.dragProps.onDragEnter(makeDragEvent());
		});
		expect(result.current.isDragging).toBe(true);

		act(() => {
			result.current.dragProps.onDragLeave(makeDragEvent());
		});
		expect(result.current.isDragging).toBe(true);

		act(() => {
			result.current.dragProps.onDragLeave(makeDragEvent());
		});
		expect(result.current.isDragging).toBe(false);
	});

	it('onDrop callback is called with resolved entries on drop', async () => {
		const resolvedFiles = [{file: new File(['x'], 'x.txt'), relativePath: 'x.txt'}];
		vi.mocked(resolveDropEntriesModule.resolveDropEntries).mockResolvedValue(resolvedFiles);

		const onDrop = vi.fn();
		const {result} = renderHook(() => useDragUpload({disabled: false, onDrop}));

		await act(async () => {
			result.current.dragProps.onDrop(makeDragEvent());
		});

		expect(onDrop).toHaveBeenCalledWith(resolvedFiles);
	});

	it('all handlers are no-ops when disabled is true', () => {
		const onDrop = vi.fn();
		const {result} = renderHook(() => useDragUpload({disabled: true, onDrop}));

		act(() => {
			result.current.dragProps.onDragEnter(makeDragEvent());
		});

		expect(result.current.isDragging).toBe(false);
		expect(onDrop).not.toHaveBeenCalled();
	});

	it('isDragging stays false when disabled even after dragenter', () => {
		const {result} = renderHook(() => useDragUpload({disabled: true, onDrop: vi.fn()}));

		act(() => {
			result.current.dragProps.onDragEnter(makeDragEvent());
			result.current.dragProps.onDragOver(makeDragEvent());
		});

		expect(result.current.isDragging).toBe(false);
	});
});
