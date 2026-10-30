import { useCallback, useState } from 'react'

/** Per-browser UI preference. Storage can be unavailable (private mode), so every access is guarded. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* preference just won't persist */
      }
    },
    [key],
  )
  return [value, update] as const
}
