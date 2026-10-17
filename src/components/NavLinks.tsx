'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function isActive(path: string, to: string) {
  if (to === '/') return path === '/' || path.startsWith('/laden/')
  if (to === '/profil') return path === '/profil' || path.startsWith('/u/')
  return path === to || path.startsWith(to + '/')
}

export function NavLinks({ user }: { user: { username: string; isAdmin: boolean } | null }) {
  const path = usePathname()
  const link = (to: string, label: string) => (
    <Link href={to} className={isActive(path, to) ? 'active' : ''}>
      {label}
    </Link>
  )
  return (
    <nav className="main-nav">
      {link('/', 'Ranking')}
      {link('/karte', 'Karte')}
      {link('/vorschlagen', 'Vorschlagen')}
      {user?.isAdmin && link('/admin', 'Admin')}
      {user ? link('/profil', user.username) : link('/login', 'Login')}
    </nav>
  )
}
