import {S3Client} from '@aws-sdk/client-s3';
import {FetchHttpHandler} from '@smithy/fetch-http-handler';
import {S3Storage} from './storage-real';
import {createApp} from './app';

const endpoint = process.env['S3_ENDPOINT'];
const accessKeyId = process.env['S3_ACCESS_KEY_ID'];
const secretAccessKey = process.env['S3_SECRET_ACCESS_KEY'];
const region = process.env['S3_REGION'];

if (!endpoint || !accessKeyId || !secretAccessKey || !region) {
	const missing = ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_REGION'].filter(
		(key) => !process.env[key],
	);
	process.stderr.write(`Missing required environment variables: ${missing.join(', ')}\n`);
	process.exit(1);
}

const client = new S3Client({
	endpoint,
	credentials: {
		accessKeyId,
		secretAccessKey,
	},
	region,
	forcePathStyle: true,
	requestHandler: new FetchHttpHandler(),
	requestChecksumCalculation: 'WHEN_REQUIRED',
	responseChecksumValidation: 'WHEN_REQUIRED',
});

const storage = new S3Storage(client);
const app = createApp(storage);

Bun.serve({
	port: 8080,
	maxRequestBodySize: 20 * 1024 * 1024 * 1024, // 20 GB
	fetch: (req: Request) => app.fetch(req),
});
