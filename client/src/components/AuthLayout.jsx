export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="brand">Nexora</p>
        <h1>{title}</h1>
        {subtitle ? <p className="lede">{subtitle}</p> : null}
        {children}
        {footer ? <div className="auth-links">{footer}</div> : null}
      </section>
    </main>
  );
}

export function Field({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <small>{error}</small> : null}
    </label>
  );
}

export function Banner({ tone = 'error', children }) {
  if (!children) return null;
  return <p className={`banner ${tone}`} role={tone === 'ok' ? 'status' : 'alert'}>{children}</p>;
}
