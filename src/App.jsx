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
  const { ready, error, memberId } = useAuth()
  if (!ready) return <div className="center-screen"><Loading /></div>
  if (error) return <ConnectError error={error} />
  if (!memberId) return <MemberPicker />
  return <Shell />
}

function Shell() {
  const { me, switchMember, demo } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const loc = useLocation()
  const inMore = !MOBILE_MAIN.includes(loc.pathname)

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand"><Logo size={40} /><span className="brand-name">{BAND_NAME}</span></NavLink>
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} /> <span>{n.label}</span></NavLink>
          ))}
        </nav>
        <div className="me">
          {demo && <span className="tag warn" title="Firebase isn't configured yet. Data is only saved in this browser.">Demo</span>}
          <Avatar id={me.id} size={30} />
          <span className="me-name">{me.name}</span>
          <button className="icon-btn" onClick={switchMember} title="Switch member" aria-label="Switch member"><Icon name="logout" size={18} /></button>
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
            <button onClick={switchMember}><Icon name="logout" size={22} /><span>Not {me.name}? Switch member</span></button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectError({ error }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size={120} />
        <h1>Can't connect</h1>
        <p className="muted">{error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed'
          ? 'Anonymous sign-in is not enabled in Firebase (Authentication → Sign-in method → Anonymous).'
          : `Check your internet connection and try again. (${error.code || error.message})`}</p>
        <button className="btn primary block" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </div>
  )
}

function MemberPicker() {
  const { chooseMember, demo } = useAuth()
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size={150} />
        <h1>Who are you?</h1>
        <p className="muted">{demo
          ? "Demo mode: Firebase isn't connected yet, so data stays in this browser only."
          : 'Tap your name. This device will remember it.'}</p>
        <div className="member-grid">
          {MEMBERS.map((m) => (
            <button key={m.id} className="member-pick" onClick={() => chooseMember(m.id)}>
              <Avatar id={m.id} size={44} />
              <strong>{m.name}</strong>
              <span className="muted small">{m.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
