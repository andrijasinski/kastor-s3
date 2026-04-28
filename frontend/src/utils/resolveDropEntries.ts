export interface ResolvedFile {
	file: File;
	relativePath: string;
}

export const resolveDropEntries = (items: DataTransferItemList): Promise<ResolvedFile[]> => {
	const entries: FileSystemEntry[] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item?.kind === 'file') {
			const entry = item.webkitGetAsEntry();
			if (entry !== null) {
				entries.push(entry);
			}
		}
	}
	return Promise.all(entries.map((e) => resolveEntry(e, ''))).then((results) => results.flat());
};

function resolveEntry(entry: FileSystemEntry, basePath: string): Promise<ResolvedFile[]> {
	if (entry.isFile) {
		return new Promise<ResolvedFile[]>((resolve, reject) => {
			(entry as FileSystemFileEntry).file((file) => {
				const relativePath = basePath !== '' ? `${basePath}/${entry.name}` : entry.name;
				resolve([{file, relativePath}]);
			}, reject);
		});
	}
	const dirPath = basePath !== '' ? `${basePath}/${entry.name}` : entry.name;
	return readAllEntries((entry as FileSystemDirectoryEntry).createReader()).then((children) =>
		Promise.all(children.map((child) => resolveEntry(child, dirPath))).then((results) =>
			results.flat(),
		),
	);
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
	const all: FileSystemEntry[] = [];
	for (;;) {
		const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
			reader.readEntries(resolve, reject);
		});
		if (batch.length === 0) {
			break;
		}
		all.push(...batch);
	}
	return all;
}
