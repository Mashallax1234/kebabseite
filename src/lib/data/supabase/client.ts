import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function supabaseEnv() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL oder SUPABASE_PUBLISHABLE_KEY fehlt (siehe .env.example).')
  return { url, key }
}

/** Supabase-Client für den aktuellen Request, Sitzung liegt in Cookies */
export async function createSupabase() {
  const { url, key } = supabaseEnv()
  const jar = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options))
        } catch {
          // In Server Components darf man keine Cookies setzen – das erledigt proxy.ts
        }
      },
    },
  })
}
