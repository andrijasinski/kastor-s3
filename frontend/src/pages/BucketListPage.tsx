import { useEffect, useState } from 'react';
import { Container, Title, Stack, Text, Paper, Anchor } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { Bucket } from '@shared/types';
import { fetchBuckets } from '../api/client';

export const BucketListPage = () => {
	const [buckets, setBuckets] = useState<Bucket[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		void fetchBuckets()
			.then((data) => {
				if (!cancelled) {
					setBuckets(data);
					setLoading(false);
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'Unknown error');
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (loading) {
		return <Text>Loading…</Text>;
	}

	if (error !== null) {
		return <Text c="red">{error}</Text>;
	}

	return (
		<Container size="md" py="xl">
			<Title mb="md">Buckets</Title>
			<Stack gap="xs">
				{buckets.map((bucket) => (
					<Paper key={bucket.name} withBorder p="sm">
						<Anchor component={Link} to={`/buckets/${bucket.name}`}>
							{bucket.name}
						</Anchor>
					</Paper>
				))}
			</Stack>
		</Container>
	);
};
