import { Button, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { apiJson } from '../api';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const login = useMutation({
    mutationFn: () =>
      apiJson<{ ok: boolean }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => navigate({ to: '/' }),
  });

  return (
    <Stack maw={400} mx="auto" mt="xl" p="md">
      <Title order={3}>Admin login</Title>
      <PasswordInput
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
        autoComplete="current-password"
      />
      {login.isError ? (
        <Text c="red">{(login.error as Error).message}</Text>
      ) : null}
      <Button loading={login.isPending} onClick={() => login.mutate()}>
        Sign in
      </Button>
      <Text size="sm">
        <Link to="/">Back to dashboard</Link>
      </Text>
    </Stack>
  );
}
