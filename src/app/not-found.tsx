import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="wrap page">
      <h1>Hier gibt&apos;s nix</h1>
      <p>
        Die Seite gibt es nicht. <Link href="/">Zur Liste</Link>
      </p>
    </main>
  )
}
