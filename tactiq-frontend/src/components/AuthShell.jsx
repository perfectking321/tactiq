import Logo from './Logo'

export default function AuthShell({ title, subtitle, wide = false, children }) {
  return (
    <div className="page page-auth">
      <header className="auth-header">
        <Logo />
      </header>
      <main className={`auth-main${wide ? ' auth-main--wide' : ''}`}>
        <div className={`card ${wide ? 'profile-card' : 'auth-card'}`}>
          <h1>{title}</h1>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}
