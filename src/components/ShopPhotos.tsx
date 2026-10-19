'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { addShopPhotoAction, deleteShopPhotoAction, type ActionResult } from '@/app/actions'
import { compressImage } from '@/lib/compressImage'
import { PHOTOS_PER_USER_AND_SHOP, XP } from '@/lib/config'
import { fmtDate, nameOf } from '@/lib/format'
import type { ShopPhoto } from '@/lib/data/types'
import { Avatar } from './Avatar'

export function ShopPhotos({
  shopId,
  photos,
  me,
  loginHref,
}: {
  shopId: string
  photos: ShopPhoto[]
  me: { id: string; isAdmin: boolean } | null
  loginHref: string
}) {
  const [result, setResult] = useState<ActionResult>({})
  const [busy, setBusy] = useState(false)
  const [pending, start] = useTransition()
  const mine = me ? photos.filter((p) => p.userId === me.id).length : 0
  const full = mine >= PHOTOS_PER_USER_AND_SHOP

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // dieselbe Datei nochmal wählen können
    if (!file) return
    setResult({})
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('image', await compressImage(file), 'foto.jpg')
      start(async () => {
        const r = await addShopPhotoAction(shopId, fd)
        setResult(r.error ? r : { ok: `Danke! Dein Foto ist drin. +${XP.photo} XP` })
      })
    } catch (err) {
      setResult({ error: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  function remove(p: ShopPhoto) {
    const own = p.userId === me?.id
    if (!confirm(own ? 'Dein Foto löschen?' : `Foto von ${nameOf(p.author)} als Admin löschen?`)) return
    start(async () => {
      const r = await deleteShopPhotoAction(p.id)
      setResult(r.error ? r : { ok: 'Foto gelöscht.' })
    })
  }

  return (
    <section className="photos">
      <div className="section-head">
        <h2>Fotos aus der Community ({photos.length})</h2>
        {me ? (
          <label className={'btn' + (full ? ' disabled' : '')} title={full ? `Maximal ${PHOTOS_PER_USER_AND_SHOP} Fotos pro Laden` : undefined}>
            {busy ? 'Wird verkleinert …' : pending ? 'Wird hochgeladen …' : '+ Foto hochladen'}
            <input type="file" accept="image/*" hidden disabled={busy || pending || full} onChange={onFile} />
          </label>
        ) : (
          <Link className="btn" href={loginHref}>
            Einloggen und Foto hochladen
          </Link>
        )}
      </div>
      {result.error && <p className="error">{result.error}</p>}
      {result.ok && <p className="ok">{result.ok}</p>}
      {photos.length ? (
        <ul className="photo-grid">
          {photos.map((p) => (
            <li key={p.id}>
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                <img src={p.url} alt={`Foto von ${nameOf(p.author)}`} loading="lazy" />
              </a>
              <span className="muted small photo-meta">
                <Avatar person={p.author} size={20} />
                {p.author ? <Link href={`/u/${encodeURIComponent(p.author.username)}`}>{nameOf(p.author)}</Link> : 'unbekannt'} ·{' '}
                {fmtDate(p.createdAt)}
                {me && (p.userId === me.id || me.isAdmin) && (
                  <>
                    {' · '}
                    <button type="button" className="linkish small" disabled={pending} onClick={() => remove(p)}>
                      löschen
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Noch keine Fotos. Zeig, wie der Döner hier aussieht.</p>
      )}
      {me && (
        <p className="hint">
          Jedes Foto bringt {XP.photo} XP. Fotos werden vor dem Hochladen verkleinert. Bis zu {PHOTOS_PER_USER_AND_SHOP} pro Laden.
        </p>
      )}
    </section>
  )
}
