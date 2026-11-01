import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import AuthLayout, { Banner, Field } from '../components/AuthLayout';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  async function sendCode(event) {
    event.preventDefault();
    setErrors({});
    setMessage('');
    if (!email.trim()) {
      setErrors({ email: 'Enter your email address.' });
      return;
    }
    setPending(true);
    try {
      const data = await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setNotice(data.message);
      setStep(2);
    } catch (error) {
      setMessage(error.message);
      setErrors(error.errors || {});
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    const next = {};
    if (!/^\d{6}$/.test(code)) next.code = 'Enter the 6-digit code.';
    if (password.length < 8) next.password = 'Use at least 8 characters with one letter and one number.';
    if (password !== confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) return;

    setPending(true);
    try {
      const data = await api('/api/auth/reset-password', {
        method: 'POST',
        body: { email, code, password },
      });
      navigate('/login', { state: { notice: data.message } });
    } catch (error) {
      setMessage(error.message);
      setErrors(error.errors || {});
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle={step === 1 ? 'We will email a reset code if an account exists.' : `Enter the code sent to ${email} and choose a new password.`}
      footer={<Link to="/login">Log in</Link>}
    >
      {step === 1 ? (
        <form onSubmit={sendCode}>
          <Banner>{message}</Banner>
          <Field label="Email" error={errors.email}>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <button className="button" type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword}>
          <Banner tone="ok">{notice}</Banner>
          <Banner>{message}</Banner>
          <Field label="Reset code" error={errors.code}>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </Field>
          <Field label="New password" error={errors.password}>
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
          <button className="button" type="submit" disabled={pending}>
            {pending ? 'Updating…' : 'Reset password'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
