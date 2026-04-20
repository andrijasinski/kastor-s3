export interface DeleteFailure {
	key: string;
	code: string;
	message: string;
}

export class PartialDeleteError extends Error {
	public readonly failures: DeleteFailure[];

	public constructor(failures: DeleteFailure[]) {
		super(`${failures.length} object(s) failed to delete`);
		this.name = 'PartialDeleteError';
		this.failures = failures;
	}
}
