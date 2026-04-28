import {describe, expect, it} from 'vitest';
import {resolveDropEntries} from '../utils/resolveDropEntries';

function makeFile(name: string): File {
	return new File(['content'], name);
}

function makeFileEntry(file: File): FileSystemFileEntry {
	return {
		name: file.name,
		isFile: true,
		isDirectory: false,
		fullPath: `/${file.name}`,
		filesystem: null as unknown as FileSystem,
		getParent: () => undefined,
		file: (success: (file: File) => void) => {
			success(file);
		},
	} as unknown as FileSystemFileEntry;
}

function makeDirectoryEntry(
	name: string,
	children: FileSystemEntry[],
	batchSize?: number,
): FileSystemDirectoryEntry {
	const batch = batchSize ?? children.length;
	return {
		name,
		isFile: false,
		isDirectory: true,
		fullPath: `/${name}`,
		filesystem: null as unknown as FileSystem,
		getParent: () => undefined,
		createReader: (): FileSystemDirectoryReader => {
			let idx = 0;
			return {
				readEntries: (success: (entries: FileSystemEntry[]) => void) => {
					const slice = children.slice(idx, idx + batch);
					idx += batch;
					success(slice);
				},
			};
		},
	} as unknown as FileSystemDirectoryEntry;
}

function makeItemList(entries: FileSystemEntry[]): DataTransferItemList {
	const items = entries.map((entry) => ({
		kind: 'file' as const,
		type: '',
		getAsFile: () => null,
		getAsString: (_: (s: string) => void) => undefined,
		webkitGetAsEntry: () => entry,
	}));
	const obj = {
		length: items.length,
		add: () => null,
		clear: () => undefined,
		remove: () => undefined,
		[Symbol.iterator]: function* () {
			yield* items;
		},
	} as unknown as DataTransferItemList;
	for (let i = 0; i < items.length; i++) {
		(obj as unknown as Record<number, (typeof items)[number]>)[i] = items[i]!;
	}
	return obj;
}

describe('resolveDropEntries — flat files (Phase 1)', () => {
	it('resolves flat files with correct relativePath', async () => {
		const file1 = makeFile('a.txt');
		const file2 = makeFile('b.png');
		const list = makeItemList([makeFileEntry(file1), makeFileEntry(file2)]);

		const result = await resolveDropEntries(list);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({file: file1, relativePath: 'a.txt'});
		expect(result[1]).toEqual({file: file2, relativePath: 'b.png'});
	});

	it('returns an empty array for an empty item list', async () => {
		const list = makeItemList([]);
		const result = await resolveDropEntries(list);
		expect(result).toEqual([]);
	});
});

describe('resolveDropEntries — recursive folders (Phase 2)', () => {
	it('resolves a single-level directory with correct relative paths', async () => {
		const file1 = makeFile('img.png');
		const file2 = makeFile('notes.txt');
		const dirEntry = makeDirectoryEntry('mydir', [makeFileEntry(file1), makeFileEntry(file2)]);
		const list = makeItemList([dirEntry]);

		const result = await resolveDropEntries(list);

		expect(result).toHaveLength(2);
		expect(result.map((r) => r.relativePath).sort()).toEqual([
			'mydir/img.png',
			'mydir/notes.txt',
		]);
	});

	it('resolves deeply nested directories with correct relative paths', async () => {
		const deepFile = makeFile('deep.txt');
		const inner = makeDirectoryEntry('inner', [makeFileEntry(deepFile)]);
		const outer = makeDirectoryEntry('outer', [inner]);
		const list = makeItemList([outer]);

		const result = await resolveDropEntries(list);

		expect(result).toHaveLength(1);
		expect(result[0]?.relativePath).toBe('outer/inner/deep.txt');
	});

	it('handles a mixed drop of loose files and folders', async () => {
		const looseFile = makeFile('loose.txt');
		const dirFile = makeFile('inside.txt');
		const dirEntry = makeDirectoryEntry('myfolder', [makeFileEntry(dirFile)]);
		const list = makeItemList([makeFileEntry(looseFile), dirEntry]);

		const result = await resolveDropEntries(list);

		expect(result).toHaveLength(2);
		const paths = result.map((r) => r.relativePath).sort();
		expect(paths).toEqual(['loose.txt', 'myfolder/inside.txt']);
	});

	it('fully resolves a directory with more than 100 entries via readEntries loop', async () => {
		const files = Array.from({length: 101}, (_, i) => makeFile(`file${i}.txt`));
		const fileEntries = files.map((f) => makeFileEntry(f));
		const dirEntry = makeDirectoryEntry('bigdir', fileEntries, 100);
		const list = makeItemList([dirEntry]);

		const result = await resolveDropEntries(list);

		expect(result).toHaveLength(101);
		expect(result.every((r) => r.relativePath.startsWith('bigdir/'))).toBe(true);
	});
});
