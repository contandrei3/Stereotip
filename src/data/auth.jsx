import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth, isFirebaseConfigured } from './firebase'
import { MEMBERS } from '../config'

// No passwords: each device silently gets an anonymous Firebase session
// (so the database only talks to this app), and the member just taps
// their name once. The choice is remembered on that device.
const Ctx = createContext(null)
const KEY = 'stereotip:member'
const saved = () => {
  const id = localStorage.getItem(KEY)
  return MEMBERS.some((m) => m.id === id) ? id : null
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, error: null, memberId: saved() })

  useEffect(() => {
    if (!isFirebaseConfigured) { setState((s) => ({ ...s, ready: true })); return }
    return onAuthStateChanged(auth, (user) => {
      if (user) return setState((s) => ({ ...s, ready: true, error: null }))
      signInAnonymously(auth).catch((error) => {
        console.error(error)
        setState((s) => ({ ...s, ready: true, error }))
      })
    })
  }, [])

  const value = {
    ...state,
    me: MEMBERS.find((m) => m.id === state.memberId) ?? null,
    demo: !isFirebaseConfigured,
    chooseMember(id) {
      localStorage.setItem(KEY, id)
      setState((s) => ({ ...s, memberId: id }))
    },
    switchMember() {
      localStorage.removeItem(KEY)
      setState((s) => ({ ...s, memberId: null }))
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
