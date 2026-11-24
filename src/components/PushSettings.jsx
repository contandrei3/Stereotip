import { useEffect, useState } from 'react'
import { useAuth } from '../data/auth'
import { pushStatus, enablePush, disablePush, testNotification, isIOS } from '../lib/push'
import Icon from './Icon'

/** Turn phone notifications on/off for this device. `compact` = banner style for the home page. */
export default function PushSettings({ compact, onDone }) {
  const { memberId } = useAuth()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [hidden, setHidden] = useState(() => { try { return compact && localStorage.getItem('stereotip:pushPromptHidden') === '1' } catch { return false } })
  const hide = () => { try { localStorage.setItem('stereotip:pushPromptHidden', '1') } catch { /* ignore */ } setHidden(true) }
  const refresh = () => pushStatus().then(setStatus).catch(() => setStatus('unsupported'))
  useEffect(() => { refresh() }, [])

  const turnOn = async () => {
    setBusy(true); setMsg('')
    try { await enablePush(memberId); await refresh(); setMsg('Done! You\'ll get notifications on this device.'); onDone?.() }
    catch (e) {
      await refresh()
      setMsg(e.message === 'denied' ? 'Notifications are blocked. Allow them for this site in your phone/browser settings, then try again.'
        : e.message === 'dismissed' ? 'You closed the question. Tap the button again and choose "Allow".'
          : `Couldn't turn on notifications: ${e.message}`)
    } finally { setBusy(false) }
  }
  const turnOff = async () => { setBusy(true); try { await disablePush() } finally { await refresh(); setBusy(false); setMsg('') } }

  if (status === null || hidden) return null
  if (compact && (status === 'on' || status === 'unsupported' || status === 'denied')) return null

  return (
    <div className={`push-card ${compact ? 'compact' : ''} ${status}`}>
      <div className="push-head">
        <span className="push-icon"><Icon name="bell" size={20} /></span>
        <div className="grow">
          <strong>Phone notifications</strong>
          <span className="muted small">
            {status === 'on' ? 'On for this device ✓'
              : status === 'off' ? 'Get new events, polls, tasks, notes and reminders on your lock screen.'
                : status === 'ios-needs-install' ? 'On iPhone, notifications only work from the Home Screen app.'
                  : status === 'denied' ? 'Blocked for this site.'
                    : "This browser can't receive notifications."}
          </span>
        </div>
      </div>

      {status === 'ios-needs-install' && (
        <ol className="push-steps">
          <li>Tap the <b>Share</b> button <span className="muted">(square with an arrow)</span> in Safari</li>
          <li>Choose <b>Add to Home Screen</b></li>
          <li>Open <b>Stereo.tip</b> from your Home Screen and turn notifications on there</li>
        </ol>
      )}
      {status === 'denied' && (
        <p className="small muted">{isIOS() ? 'Open iPhone Settings → Notifications → Stereo.tip → Allow Notifications.' : 'Tap the lock/settings icon next to the address bar → Notifications → Allow, then reload.'}</p>
      )}
      {status === 'unsupported' && <p className="small muted">Try Chrome on Android, or the Home Screen app on iPhone (iOS 16.4 or newer).</p>}

      <div className="push-actions">
        {status === 'off' && <button className="btn primary small" onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on notifications'}</button>}
        {compact && <button className="btn ghost small" onClick={hide}>Not now</button>}
        {status === 'on' && <>
          <button className="btn small" onClick={() => testNotification()}>Send a test</button>
          <button className="btn ghost small" onClick={turnOff} disabled={busy}>Turn off</button>
        </>}
      </div>
      {msg && <p className="small push-msg">{msg}</p>}
      {compact && <p className="muted small">You can always change this from the bell 🔔 at the top.</p>}
    </div>
  )
}
