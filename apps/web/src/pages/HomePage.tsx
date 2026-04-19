import type { StatsOverview } from '@kobuddy/common';
import {
  Anchor,
  Card,
  Grid,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { apiJson } from '../api';

export function HomePage() {
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiJson<StatsOverview>('/api/stats'),
  });

  if (stats.isLoading) {
    return (
      <Group justify="center" p="xl">
        <Loader />
      </Group>
    );
  }

  if (stats.isError) {
    return (
      <Stack p="md">
        <Text c="red">{(stats.error as Error).message}</Text>
        <Anchor component={Link} to="/login">
          Admin login
        </Anchor>
      </Stack>
    );
  }

  const s = stats.data;
  if (!s) return null;

  return (
    <Stack p="md" gap="lg">
      <Group justify="space-between">
        <Title order={2}>kobuddy</Title>
        <Anchor component={Link} to="/login" size="sm">
          Login
        </Anchor>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Total reading time
            </Text>
            <Title order={3}>
              {Math.round(s.totalReadingTimeSeconds / 3600)}h
            </Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Total pages (from KOReader totals)
            </Text>
            <Title order={3}>{s.totalPagesRead}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Last 7 days
            </Text>
            <Title order={3}>
              {Math.round(s.last7DaysReadTimeSeconds / 60)} min
            </Title>
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder>
        <Title order={4} mb="sm">
          API
        </Title>
        <Text size="sm">
          OpenAPI docs: <a href="/api/docs">/api/docs</a> · Plugin zip:{' '}
          <a href="/plugin.zip">/plugin.zip</a>
        </Text>
      </Card>
    </Stack>
  );
}
