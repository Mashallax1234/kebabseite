'use client'
import { useTransition } from 'react'
import { deleteRatingAction } from '@/app/actions'

export function DeleteRatingButton({ ratingId, name }: { ratingId: string; name: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      className="linkish small"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Bewertung von ${name} löschen?`)) return
        start(async () => {
          const r = await deleteRatingAction(ratingId)
          if (r.error) alert(r.error)
        })
      }}
    >
      als Admin löschen
    </button>
  )
}
