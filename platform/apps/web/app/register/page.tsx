'use client';

import { Input } from '@platform/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthCard, AuthForm, AuthLink, PasswordField } from '../../src/components/auth-card';
import { registerAccount } from '../../src/lib/api';
import { hasErrors, validateRegister } from '../../src/lib/auth-rules';
import { ApiError } from '../../src/lib/session';
import { useSession } from '../../src/stores/session-store';

export default function RegisterPage() {
  const router = useRouter();
  const status = useSession((state) => state.status);
  const setSession = useSession((state) => state.setSession);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof validateRegister>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/chats');
  }, [router, status]);

  if (status !== 'anonymous') {
    return <p className="grid min-h-dvh place-items-center bg-canvas text-sm text-muted">Checking your session…</p>;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateRegister(username, email, phone, password, confirm);
    setErrors(nextErrors);
    setFormError('');
    if (hasErrors(nextErrors)) return;
    setLoading(true);
    try {
      const result = await registerAccount({ username, email, phone, password });
      setSession(result);
      router.replace('/chats');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'The server did not respond. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      description="Choose a username and the email that will receive your login code."
      footer={<>Already have an account? <AuthLink href="/login">Sign in</AuthLink></>}
    >
      <AuthForm error={formError} loading={loading} submitLabel="Create account" onSubmit={onSubmit}>
        <Input
          label="Username"
          name="username"
          autoComplete="username"
          value={username}
          error={errors.username}
          hint="Letters, numbers, and underscores."
          onChange={(event) => setUsername(event.target.value)}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Phone"
          name="phone"
          autoComplete="tel"
          value={phone}
          error={errors.phone}
          hint="Optional. You can also sign in with this number."
          onChange={(event) => setPhone(event.target.value)}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={setPassword}
        />
        <PasswordField
          label="Confirm password"
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={setConfirm}
        />
      </AuthForm>
    </AuthCard>
  );
}
