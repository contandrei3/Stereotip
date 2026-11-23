import { useState } from 'react'
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './data/auth'
import { Logo, Avatar, Loading } from './components/ui'
import Icon from './components/Icon'
import { MEMBERS, BAND_NAME } from './config'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
import Songs from './pages/Songs'
import Tasks from './pages/Tasks'
import Money from './pages/Money'
import Reminders from './pages/Reminders'
import Journal from './pages/Journal'

const NAV = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/songs', label: 'Songs', icon: 'music' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/money', label: 'Money', icon: 'money' },
  { to: '/reminders', label: 'Reminders', icon: 'bell' },
  { to: '/journal', label: 'Journal', icon: 'journal' },
]
const MOBILE_MAIN = ['/', '/calendar', '/songs', '/journal']

export default function App() {
  const { ready, user, memberId } = useAuth()
  if (!ready) return <div className="center-screen"><Loading /></div>
  if (!user) return <Login />
  if (!memberId) return <MemberPicker />
  return <Shell />
}

function Shell() {
  const { me, logout, demo } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const loc = useLocation()
  const inMore = !MOBILE_MAIN.includes(loc.pathname)

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand"><Logo size={34} /><span className="brand-name">{BAND_NAME}</span></NavLink>
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} /> <span>{n.label}</span></NavLink>
          ))}
        </nav>
        <div className="me">
          {demo && <span className="tag warn" title="Firebase isn't configured yet. Data is only saved in this browser.">Demo</span>}
          <Avatar id={me.id} size={30} />
          <span className="me-name">{me.name}</span>
          <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><Icon name="logout" size={18} /></button>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/songs" element={<Songs />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/money" element={<Money />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="tabbar">
        {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMoreOpen(false)}>
            <Icon name={n.icon} size={22} /><span>{n.label}</span>
          </NavLink>
        ))}
        <button className={inMore || moreOpen ? 'active' : ''} onClick={() => setMoreOpen((o) => !o)}>
          <Icon name="more" size={22} /><span>More</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="more-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            {NAV.filter((n) => !MOBILE_MAIN.includes(n.to)).map((n) => (
              <NavLink key={n.to} to={n.to} onClick={() => setMoreOpen(false)}>
                <Icon name={n.icon} size={22} /><span>{n.label}</span>
              </NavLink>
            ))}
            <button onClick={logout}><Icon name="logout" size={22} /><span>Sign out ({me.name})</span></button>
          </div>
        </div>
      )}
    </div>
  )
}

function Login() {
  const { demo, login, resetPassword, chooseMember } = useAuth()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (demo) return <MemberPicker onPick={chooseMember} demoIntro />

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await login(email, pw) } catch (e) {
      setErr(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
        ? 'Wrong e-mail or password.' : e.message)
    } finally { setBusy(false) }
  }
  const reset = async () => {
    setErr(''); setInfo('')
    if (!email) return setErr('Type your e-mail first, then tap "Forgot password".')
    try { await resetPassword(email); setInfo('Password reset e-mail sent.') } catch (e) { setErr(e.message) }
  }
  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <Logo size={88} />
        <h1>{BAND_NAME} <span className="muted">Band Hub</span></h1>
        <p className="muted">Members only. Sign in with your band account.</p>
        <input type="email" autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" autoComplete="current-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="error-text">{err}</p>}
        {info && <p className="ok-text">{info}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="btn ghost block" onClick={reset}>Forgot password</button>
      </form>
    </div>
  )
}

function MemberPicker({ demoIntro }) {
  const { chooseMember, logout, demo } = useAuth()
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size={88} />
        <h1>Who are you?</h1>
        {demoIntro
          ? <p className="muted">Demo mode: Firebase isn't connected yet, so data stays in this browser only.</p>
          : <p className="muted">Pick your name once. We'll remember it for this account.</p>}
        <div className="member-grid">
          {MEMBERS.map((m) => (
            <button key={m.id} className="member-pick" onClick={() => chooseMember(m.id)}>
              <Avatar id={m.id} size={44} />
              <strong>{m.name}</strong>
              <span className="muted small">{m.role}</span>
            </button>
          ))}
        </div>
        {!demo && <button className="btn ghost block" onClick={logout}>Sign out</button>}
      </div>
    </div>
  )
}
