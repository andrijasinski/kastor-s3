import {useEffect, useState} from 'react';
import {Container, Title, Stack, Text, Paper, Anchor, Group, Loader, Badge} from '@mantine/core';
import {notifications} from '@mantine/notifications';
import {Link} from 'react-router-dom';
import type {Bucket, BucketStats} from '@shared/types';
import {fetchBuckets, fetchBucketStats} from '../api/client';
import {formatDate, formatSize} from '../utils/format';

type StatsState = {status: 'loading'} | {status: 'ok'; data: BucketStats} | {status: 'error'};

const BucketCard = ({bucket}: {bucket: Bucket}) => {
	const [stats, setStats] = useState<StatsState>({status: 'loading'});

	useEffect(() => {
		let cancelled = false;
		void fetchBucketStats(bucket.name)
			.then((data) => {
				if (!cancelled) {
					setStats({status: 'ok', data});
				}
			})
			.catch(() => {
				if (!cancelled) {
					setStats({status: 'error'});
				}
			});
		return () => {
			cancelled = true;
		};
	}, [bucket.name]);

	return (
		<Paper withBorder p="md" w="100%">
			<Group justify="space-between" wrap="nowrap" align="flex-start">
				<Stack gap={4}>
					<Anchor
						component={Link}
						to={`/buckets/${bucket.name}`}
						style={{wordBreak: 'break-all'}}
						fw={500}
					>
						{bucket.name}
					</Anchor>
					<Group gap="xs">
						{bucket.region !== '' && (
							<Badge variant="light" size="sm">
								{bucket.region}
							</Badge>
						)}
						<Text size="xs" c="dimmed">
							Created {formatDate(bucket.creationDate)}
						</Text>
					</Group>
				</Stack>
				<Stack gap={2} align="flex-end" style={{flexShrink: 0}}>
					{stats.status === 'loading' && <Loader size="xs" />}
					{stats.status === 'error' && (
						<Text size="xs" c="dimmed">
							unavailable
						</Text>
					)}
					{stats.status === 'ok' && (
						<>
							<Text size="sm">{stats.data.objectCount.toLocaleString()} objects</Text>
							<Text size="xs" c="dimmed">
								{formatSize(stats.data.totalSize)}
							</Text>
						</>
					)}
				</Stack>
			</Group>
		</Paper>
	);
};

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
		<Container size="lg" py="xl">
			<Title mb="md">Buckets</Title>
			<Stack gap="xs">
				{buckets.map((bucket) => (
					<BucketCard key={bucket.name} bucket={bucket} />
				))}
			</Stack>
		</Container>
	);
};
