import { useEffect, useState } from 'react'
import { watch } from './store'

export function useCollection(name, filter) {
  const [state, setState] = useState({ rows: [], loading: true, error: null })
  const f0 = filter?.[0], f1 = filter?.[1]
  const skip = filter && (f1 === undefined || f1 === null)
  useEffect(() => {
    if (skip) { setState({ rows: [], loading: false, error: null }); return }
    return watch(name, filter ? [f0, f1] : null, (s) =>
      setState({ rows: s.rows, loading: s.loading, error: s.error }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, f0, f1, skip])
  return state
}
