'use client'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <h1>Mist</h1>
      <p className="error">Da ist was schiefgelaufen{error.message ? `: ${error.message}` : '.'}</p>
      <button className="btn" onClick={reset}>
        Nochmal versuchen
      </button>
    </>
  )
}
