"use client"

import { useState, useEffect, useCallback } from "react"

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(defaultValue)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (stored !== null) {
        setValue(JSON.parse(stored))
      }
    } catch {
      // localStorage unavailable or parse error — keep default
    }
    setHydrated(true)
  }, [key])

  const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = newValue instanceof Function ? newValue(prev) : newValue
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        // Storage full or unavailable — still update in-memory state
      }
      return resolved
    })
  }, [key])

  // Return default until hydrated to avoid flash
  return [hydrated ? value : defaultValue, setStoredValue]
}
