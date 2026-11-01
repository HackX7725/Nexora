'use client';

import { Button, Input } from '@platform/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthCard, AuthForm, AuthLink, PasswordField } from '../../src/components/auth-card';
import { login, resendLoginCode, verifyLogin } from '../../src/lib/api';
import { hasErrors, validateLogin, validateLoginCode } from '../../src/lib/auth-rules';
import { ApiError } from '../../src/lib/session';
import { useSession } from '../../src/stores/session-store';

export default function LoginPage() {
  const router = useRouter();
  const status = useSession((state) => state.status);
  const setSession = useSession((state) => state.setSession);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof validateLogin>>({});
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/chats');
  }, [router, status]);

  useEffect(() => {
    if (!challengeId) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challengeId]);

  if (status !== 'anonymous') {
    return <p className="grid min-h-dvh place-items-center bg-canvas text-sm text-muted">Checking your session…</p>;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateLogin(identifier, password);
    setErrors(nextErrors);
    setFormError('');
    if (hasErrors(nextErrors)) return;
    setLoading(true);
    try {
      const result = await login(identifier, password);
      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail);
      setSeconds(result.resendAvailableIn);
      setCode('');
      setCodeError('');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'The server did not respond. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = validateLoginCode(code);
    setCodeError(nextError || '');
    setFormError('');
    if (nextError) return;
    setLoading(true);
    try {
      const result = await verifyLogin(challengeId, code);
      setSession(result);
      router.replace('/chats');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'The server did not respond. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setFormError('');
    setLoading(true);
    try {
      const result = await resendLoginCode(challengeId);
      setSeconds(result.resendAvailableIn);
      setCode('');
      setCodeError('');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'The server did not respond. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (challengeId) {
    return (
      <AuthCard
        title="Check your email"
        description={`Enter the 6-digit code sent to ${maskedEmail}.`}
        footer={<button type="button" className="font-medium text-primary" onClick={() => setChallengeId('')}>Use a different account</button>}
      >
        <AuthForm error={formError} loading={loading} submitLabel="Verify code" onSubmit={onVerify}>
          <Input
            label="Login code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            error={codeError}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Button type="button" variant="secondary" disabled={loading || seconds > 0} onClick={() => void onResend()}>
            {seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}
          </Button>
        </AuthForm>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Enter your password. We email a 6-digit code before opening Nexora."
      footer={<>New to Nexora? <AuthLink href="/register">Create an account</AuthLink></>}
    >
      <AuthForm error={formError} loading={loading} submitLabel="Sign in" onSubmit={onSubmit}>
        <Input
          label="Username, email, or phone"
          name="identifier"
          autoComplete="username"
          value={identifier}
          error={errors.identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={setPassword}
        />
      </AuthForm>
    </AuthCard>
  );
}
