import Link from 'next/link'

export default function NotFound() {
  return (
    <>
      <h1>Hier gibt&apos;s nix</h1>
      <p>
        Die Seite gibt es nicht (mehr). <Link href="/">Zur Liste</Link>
      </p>
    </>
  )
}
