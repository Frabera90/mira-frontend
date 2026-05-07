import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

export const RISTORANTE_ID: string =
  (import.meta.env.VITE_RISTORANTE_ID as string) || 'a1000000-0000-0000-0000-000000000001'

export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:3000'
