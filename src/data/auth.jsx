import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from './firebase'
import { getItem, setItem } from './store'
import { MEMBERS } from '../config'

const Ctx = createContext(null)
const DEMO_KEY = 'stereotip:demo-member'

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, user: null, memberId: null })

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const id = localStorage.getItem(DEMO_KEY)
      setState({ ready: true, user: id ? { demo: true } : null, memberId: id })
      return
    }
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return setState({ ready: true, user: null, memberId: null })
      const email = (user.email || '').toLowerCase()
      let memberId = MEMBERS.find((m) => m.email && m.email.toLowerCase() === email)?.id ?? null
      if (!memberId) {
        try { memberId = (await getItem('users', user.uid))?.memberId ?? null } catch (e) { console.error(e) }
      }
      setState({ ready: true, user, memberId })
    })
  }, [])

  const value = {
    ...state,
    me: MEMBERS.find((m) => m.id === state.memberId) ?? null,
    demo: !isFirebaseConfigured,
    login: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
    async chooseMember(id) {
      if (!isFirebaseConfigured) {
        localStorage.setItem(DEMO_KEY, id)
        setState({ ready: true, user: { demo: true }, memberId: id })
        return
      }
      await setItem('users', state.user.uid, { memberId: id, email: state.user.email ?? '' })
      setState((s) => ({ ...s, memberId: id }))
    },
    async logout() {
      if (!isFirebaseConfigured) {
        localStorage.removeItem(DEMO_KEY)
        setState({ ready: true, user: null, memberId: null })
        return
      }
      await signOut(auth)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
