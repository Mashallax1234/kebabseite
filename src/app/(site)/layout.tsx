import Link from 'next/link'
import { NavLinks } from '@/components/NavLinks'
import { backendKind, getCurrentUser } from '@/lib/data'
import { resetDemoAction } from '@/app/actions'
import { SITE } from '@/lib/config'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const demo = backendKind() === 'demo'

  return (
    <>
      <header className="site-head">
        <div className="wrap">
          <Link className="logo" href="/">
            {SITE.name}
            <small>{SITE.tagline}</small>
          </Link>
          <NavLinks user={user ? { username: user.username, isAdmin: user.role === 'admin' } : null} />
        </div>
      </header>
      <main className="wrap page">{children}</main>
      <footer className="site-foot">
        <div className="wrap">
          <p>{SITE.name} · alle Bewertungen sind persönliche Meinung · kein Laden hat hier für irgendwas bezahlt</p>
          {demo && (
            <div className="demo-note">
              Demo-Modus: Daten liegen in <code>.data/demo.json</code>. Admin-Login: <code>hallahsam@demo.de</code> /{' '}
              <code>demo</code>.{' '}
              <form action={resetDemoAction}>
                <button className="linkish">Demo zurücksetzen</button>
              </form>
            </div>
          )}
        </div>
      </footer>
    </>
  )
}
