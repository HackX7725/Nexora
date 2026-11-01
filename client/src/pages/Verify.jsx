import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import AuthLayout, { Banner, Field } from '../components/AuthLayout';

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const email = location.state?.email || '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [seconds, setSeconds] = useState(location.state?.resendAvailableIn ?? 60);

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setInterval(() => setSeconds((current) => current - 1), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  async function onSubmit(event) {
    event.preventDefault();
    setMessage('');
    setNotice('');
    if (!/^\d{6}$/.test(code)) {
      setMessage('Enter the 6-digit code.');
      return;
    }
    setPending(true);
    try {
      const data = await api('/api/auth/verify-login', {
        method: 'POST',
        body: { email, code },
      });
      setUser(data.user);
      navigate('/rooms', { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setMessage('');
    setNotice('');
    setPending(true);
    try {
      const data = await api('/api/auth/resend-login-code', {
        method: 'POST',
        body: { email },
      });
      setNotice(data.message);
      setSeconds(data.resendAvailableIn ?? 60);
    } catch (error) {
      setMessage(error.message);
      if (error.retryAfter) setSeconds(error.retryAfter);
    } finally {
      setPending(false);
    }
  }

  if (!email) return null;

  return (
    <AuthLayout
      title="Check your email"
      subtitle={`The 6-digit code was sent to ${email}. Check that Gmail inbox, including spam. It expires in 10 minutes.`}
      footer={<Link to="/login">Back to login</Link>}
    >
      <form onSubmit={onSubmit}>
        <Banner tone="ok">{notice}</Banner>
        <Banner>{message}</Banner>
        <Field label="Verification code">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </Field>
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Verifying…' : 'Verify'}
        </button>
        <button className="button ghost" type="button" onClick={resend} disabled={pending || seconds > 0}>
          {seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}
        </button>
      </form>
    </AuthLayout>
  );
}
