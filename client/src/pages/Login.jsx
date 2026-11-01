import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import AuthLayout, { Banner, Field } from '../components/AuthLayout';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const notice = location.state?.notice || '';

  async function onSubmit(event) {
    event.preventDefault();
    const next = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) return;

    setPending(true);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      navigate('/verify', {
        state: { email: data.email, resendAvailableIn: data.resendAvailableIn ?? 60 },
      });
    } catch (error) {
      setMessage(error.message);
      setErrors(error.errors || {});
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Log in"
      subtitle="Use the Gmail address on your account. We send a 6-digit code to that inbox before the room opens."
      footer={(
        <>
          <Link to="/register">Create an account</Link>
          <Link to="/forgot-password">Forgot password</Link>
        </>
      )}
    >
      <form onSubmit={onSubmit}>
        <Banner tone="ok">{notice}</Banner>
        <Banner>{message}</Banner>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" error={errors.password}>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}
