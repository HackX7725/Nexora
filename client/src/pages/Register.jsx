import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import AuthLayout, { Banner, Field } from '../components/AuthLayout';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your name.';
    if (!form.email.trim()) next.email = 'Enter your email address.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters with one letter and one number.';
    if (form.password !== form.confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) return;

    setPending(true);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: { name: form.name, email: form.email, password: form.password },
      });
      navigate('/login', {
        state: { notice: 'Account created. Log in to receive a verification code.' },
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
      title="Create an account"
      subtitle="Your email receives a code each time you log in."
      footer={<Link to="/login">Log in</Link>}
    >
      <form onSubmit={onSubmit}>
        <Banner>{message}</Banner>
        <Field label="Name" error={errors.name}>
          <input value={form.name} autoComplete="name" onChange={(event) => update('name', event.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
        </Field>
        <Field label="Password" error={errors.password}>
          <input type="password" autoComplete="new-password" value={form.password} onChange={(event) => update('password', event.target.value)} />
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          <input type="password" autoComplete="new-password" value={form.confirm} onChange={(event) => update('confirm', event.target.value)} />
        </Field>
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
