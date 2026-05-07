import { createContext, useContext } from 'react'

export const RistoranteContext = createContext<string>(
  (import.meta.env.VITE_RISTORANTE_ID as string) || 'a1000000-0000-0000-0000-000000000001'
)

export function useRistorante(): string {
  return useContext(RistoranteContext)
}
