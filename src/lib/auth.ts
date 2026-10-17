import 'server-only'
import { redirect } from 'next/navigation'
import { getCurrentUser } from './data'

/** Für Admin-Seiten: Nicht-Admins landen beim Login */
export async function requireAdminPage(back: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') redirect('/login?weiter=' + encodeURIComponent(back))
  return user
}
