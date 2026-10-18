'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/** Wischen nach links = nächster Laden, nach rechts = vorheriger */
export function SwipeNav({ prev, next, children }: { prev: string | null; next: string | null; children: React.ReactNode }) {
  const router = useRouter()
  const start = useRef<{ x: number; y: number } | null>(null)

  // Nachbarseiten schon vorladen, damit der Wisch sofort wirkt
  useEffect(() => {
    if (prev) router.prefetch(`/laden/${prev}`)
    if (next) router.prefetch(`/laden/${next}`)
  }, [prev, next, router])

  // Auf Schiebereglern, Textfeldern und der Karte darf nicht geblättert werden
  const ignore = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, textarea, select, .minimap')

  return (
    <div
      style={{ touchAction: 'pan-y pinch-zoom' }}
      onTouchStart={(e) => {
        start.current = ignore(e.target) ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }}
      onTouchEnd={(e) => {
        const s = start.current
        start.current = null
        if (!s) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        // Nur deutlich waagerechte, lange Wischer zählen – normales Scrollen nicht
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return
        const to = dx < 0 ? next : prev
        if (to) router.push(`/laden/${to}`)
      }}
    >
      {children}
    </div>
  )
}