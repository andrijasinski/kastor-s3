import { useEffect, useState } from 'react';
import { Container, Title, Stack, Text, Paper, Anchor } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Link } from 'react-router-dom';
import type { Bucket } from '@shared/types';
import { fetchBuckets } from '../api/client';

export const BucketListPage = () => {
	const [buckets, setBuckets] = useState<Bucket[]>([]);
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
					notifications.show({
						title: 'Failed to load buckets',
						message: err instanceof Error ? err.message : 'Unknown error',
						color: 'red',
					});
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

	return (
		<Container size="md" py="xl">
			<Title mb="md">Buckets</Title>
			<Stack gap="xs">
				{buckets.map((bucket) => (
					<Paper key={bucket.name} withBorder p="sm">
						<Anchor component={Link} to={`/buckets/${bucket.name}`} style={{ wordBreak: 'break-all' }}>
							{bucket.name}
						</Anchor>
					</Paper>
				))}
			</Stack>
		</Container>
	);
};
