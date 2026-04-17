import {useParams, useSearchParams, useLocation, useNavigate, Link} from 'react-router-dom';
import {Anchor, Breadcrumbs, Button, Container, Group, Stack, Text} from '@mantine/core';
import {IconPhoto, IconChevronLeft, IconChevronRight} from '@tabler/icons-react';
import type {S3Object} from '@shared/types';
import {isImageFile} from '../utils/imageUtils';
import {formatSize, formatDate} from '../utils/format';
import {buildBreadcrumbSegments} from '../utils/breadcrumbs';

const objectUrl = (bucket: string, key: string): string =>
	`/api/buckets/${encodeURIComponent(bucket)}/object?key=${encodeURIComponent(key)}`;

export const ImagePreviewPage = () => {
	const {bucket} = useParams<{bucket: string}>();
	const [searchParams] = useSearchParams();
	const {state} = useLocation();
	const key = searchParams.get('key') ?? '';

	const navigate = useNavigate();

	const rawSiblings: S3Object[] = (state as {siblings?: S3Object[]} | null)?.siblings ?? [];
	const siblings = rawSiblings.filter((obj) => !obj.isPrefix);
	const currentIndex = siblings.findIndex((obj) => obj.key === key);
	const currentFile = currentIndex !== -1 ? siblings[currentIndex] : undefined;
	const hasSiblings = siblings.length > 0;

	const goTo = (sibling: S3Object) => {
		void navigate(
			`/buckets/${encodeURIComponent(bucket!)}/preview?key=${encodeURIComponent(sibling.key)}`,
			{state: {siblings}},
		);
	};

	if (bucket === undefined) {
		return null;
	}

	const segments = buildBreadcrumbSegments(key);
	const crumbs = [
		{label: bucket, href: `/buckets/${encodeURIComponent(bucket)}`},
		...segments.map((seg) => ({
			label: seg.label,
			href:
				seg.prefix !== null
					? `/buckets/${encodeURIComponent(bucket)}?prefix=${encodeURIComponent(seg.prefix)}`
					: null,
		})),
	];

	return (
		<>
			<Container size="lg" pt="md" pb="xl">
				<Breadcrumbs mb="xl" style={{rowGap: 8, flex: 1, minWidth: 0, paddingLeft: 8}}>
					{crumbs.map((crumb) =>
						crumb.href !== null ? (
							<Anchor key={crumb.label} component={Link} to={crumb.href}>
								{crumb.label}
							</Anchor>
						) : (
							<Text key={crumb.label} span fw={500}>
								{crumb.label}
							</Text>
						),
					)}
				</Breadcrumbs>

				<Stack align="center" gap="xl">
					{isImageFile(key) ? (
						<img
							src={objectUrl(bucket, key)}
							alt={key.split('/').pop()}
							style={{maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain'}}
						/>
					) : (
						<Stack align="center" gap="sm" py="xl">
							<IconPhoto size={64} color="gray" />
							<Text c="dimmed">No preview available</Text>
						</Stack>
					)}

					{currentFile !== undefined && (
						<Group gap="xl">
							<Stack gap={2} align="center">
								<Text size="xs" c="dimmed" tt="uppercase" fw={500}>
									Size
								</Text>
								<Text>{formatSize(currentFile.size)}</Text>
							</Stack>
							<Stack gap={2} align="center">
								<Text size="xs" c="dimmed" tt="uppercase" fw={500}>
									Last modified
								</Text>
								<Text>{formatDate(currentFile.lastModified)}</Text>
							</Stack>
						</Group>
					)}
				</Stack>
			</Container>

			<Button
				variant="default"
				style={{position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)'}}
				disabled={!hasSiblings || currentIndex <= 0}
				onClick={() => {
					const prev = siblings[currentIndex - 1];
					if (prev !== undefined) {
						goTo(prev);
					}
				}}
				aria-label="Prev"
			>
				<IconChevronLeft size={16} />
			</Button>

			<Button
				variant="default"
				style={{position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)'}}
				disabled={!hasSiblings || currentIndex >= siblings.length - 1}
				onClick={() => {
					const next = siblings[currentIndex + 1];
					if (next !== undefined) {
						goTo(next);
					}
				}}
				aria-label="Next"
			>
				<IconChevronRight size={16} />
			</Button>
		</>
	);
};
