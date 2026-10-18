import 'server-only'
import { redirect } from 'next/navigation'
import { getCurrentUser } from './data'

/** Für Admin-Seiten: Nicht-Admins landen beim Login */
export async function requireAdminPage(back: string) {
  const user = await getCurrentUser()
  
  // Prüft die Rolle, die wir über Supabase gesetzt haben
  const isAdmin = user?.role === 'admin'

  if (!user || !isAdmin) {
    redirect('/login?weiter=' + encodeURIComponent(back))
  }
  
  return user
}