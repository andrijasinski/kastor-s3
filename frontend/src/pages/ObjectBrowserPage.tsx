import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Anchor,
  Breadcrumbs,
  Container,
  Table,
  Text,
} from '@mantine/core';
import type { S3Object } from '@shared/types';
import { fetchObjects } from '../api/client';

const buildBreadcrumbs = (bucket: string, prefix: string) => {
  const parts = prefix.split('/').filter((p) => p.length > 0);
  return [
    { label: bucket, prefix: '' },
    ...parts.map((part, i) => ({
      label: part,
      prefix: `${parts.slice(0, i + 1).join('/')}/`,
    })),
  ];
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (isoString: string): string => {
  if (isoString === '') {
    return '—';
  }
  return new Date(isoString).toLocaleString();
};

export const ObjectBrowserPage = () => {
  const { bucket } = useParams<{ bucket: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefix = searchParams.get('prefix') ?? '';

  const [objects, setObjects] = useState<S3Object[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bucket === undefined) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchObjects(bucket, prefix)
      .then((data) => {
        if (!cancelled) {
          setObjects(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [bucket, prefix]);

  if (bucket === undefined) {
    return null;
  }

  const crumbs = buildBreadcrumbs(bucket, prefix);

  const navigateTo = (newPrefix: string) => {
    setSearchParams(newPrefix !== '' ? { prefix: newPrefix } : {});
  };

  return (
    <Container size="lg" py="xl">
      <Breadcrumbs mb="lg">
        {crumbs.map((crumb, i) =>
          i === crumbs.length - 1 ? (
            <Text key={crumb.prefix} span fw={500}>
              {crumb.label}
            </Text>
          ) : (
            <Anchor
              key={crumb.prefix}
              component="button"
              type="button"
              onClick={() => { navigateTo(crumb.prefix); }}
            >
              {crumb.label}
            </Anchor>
          ),
        )}
      </Breadcrumbs>

      {loading && <Text>Loading…</Text>}
      {error !== null && <Text c="red">{error}</Text>}

      {!loading && error === null && (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Size</Table.Th>
              <Table.Th>Last modified</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {objects.map((obj) => (
              <Table.Tr key={obj.key}>
                <Table.Td>
                  {obj.isPrefix ? (
                    <Anchor
                      component="button"
                      type="button"
                      onClick={() => { navigateTo(obj.key); }}
                    >
                      {obj.key.slice(prefix.length)}
                    </Anchor>
                  ) : (
                    <Text span>{obj.key.slice(prefix.length)}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text span c="dimmed">{obj.isPrefix ? '—' : formatSize(obj.size)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text span c="dimmed">{obj.isPrefix ? '—' : formatDate(obj.lastModified)}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Container>
  );
};
