'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { deleteShopAction, saveShopAction } from '@/app/actions'
import { nameOf, slugify } from '@/lib/format'
import { isComplete, pickActive, ratingOverall } from '@/lib/scores'
import { coordsFromMapsUrl, firstIssue, shopSchema, validateScores } from '@/lib/validate'
import type { Criterion, Rating, Shop, Suggestion } from '@/lib/data/types'
import { MiniMap } from './MiniMap'
import { ScoreInputs } from './ScoreInputs'
import { Score } from './ui'

const toNum = (v: string) => {
  if (!v.trim()) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function ShopEditor({
  criteria,
  shop,
  mine,
  suggestion,
}: {
  criteria: Criterion[]
  shop: Shop | null
  mine: Rating | null
  suggestion: Suggestion | null
}) {
  const fromSuggestion = !shop && suggestion
  const coords = fromSuggestion ? coordsFromMapsUrl(suggestion.mapsUrl) : null

  const [form, setForm] = useState(() => ({
    name: shop?.name ?? (fromSuggestion ? suggestion.name : ''),
    slug: shop?.slug ?? (fromSuggestion ? slugify(suggestion.name) : ''),
    address: shop?.address ?? (fromSuggestion ? (suggestion.address ?? '') : ''),
    district: shop?.district ?? '',
    mapsUrl: shop?.mapsUrl ?? (fromSuggestion ? (suggestion.mapsUrl ?? '') : ''),
    lat: shop ? String(shop.lat) : coords ? String(coords.lat) : '',
    lng: shop ? String(shop.lng) : coords ? String(coords.lng) : '',
    doenerPrice: shop?.doenerPrice != null ? String(shop.doenerPrice).replace('.', ',') : '',
    notes: shop?.notes ?? '',
  }))
  const [slugTouched, setSlugTouched] = useState(!!shop)
  const [scores, setScores] = useState(() => pickActive(mine?.scores, criteria))
  const [fazit, setFazit] = useState(mine?.fazit ?? '')
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  type Field = keyof typeof form
  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [k]: value }))
  }
  const lat = toNum(form.lat)
  const lng = toNum(form.lng)
  const hasScores = Object.keys(scores).length > 0
  const complete = isComplete(scores, criteria)

  function onName(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value
    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }))
  }
  function onMapsUrl(e: React.ChangeEvent<HTMLInputElement>) {
    const mapsUrl = e.target.value
    const c = coordsFromMapsUrl(mapsUrl)
    setForm((f) => ({ ...f, mapsUrl, ...(c ? { lat: String(c.lat), lng: String(c.lng) } : {}) }))
    setHint(
      c
        ? 'Position aus dem Link übernommen.'
        : mapsUrl
          ? 'Im Link stehen keine Koordinaten (z. B. bei Kurzlinks). Setz die Position einfach per Klick in die Karte.'
          : null,
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // Erst im Browser prüfen, damit Fehler sofort kommen – der Server prüft nochmal
    const parsed = shopSchema.safeParse(form)
    if (!parsed.success) return setError(firstIssue(parsed.error))
    if (hasScores) {
      try {
        validateScores(scores, criteria)
      } catch (err) {
        return setError((err as Error).message)
      }
    }
    start(async () => {
      const r = await saveShopAction({
        id: shop?.id ?? null,
        suggestionId: fromSuggestion ? suggestion.id : null,
        shop: form,
        scores,
        fazit,
      })
      if (r?.error) setError(r.error)
    })
  }

  function remove() {
    if (!shop || !confirm(`„${shop.name}“ wirklich löschen? Alle Bewertungen dazu sind dann auch weg.`)) return
    start(async () => {
      const r = await deleteShopAction(shop.id)
      if (r?.error) setError(r.error)
    })
  }

  return (
    <>
      <p className="crumbs">
        <Link href="/admin">← Admin</Link>
      </p>
      <h1>{shop ? `${shop.name} bearbeiten` : 'Neuer Laden'}</h1>

      {fromSuggestion && (
        <p className="note">
          Aus dem Vorschlag von {nameOf(suggestion.suggester)}
          {suggestion.note && `: „${suggestion.note}“`}. Beim Speichern wird der Vorschlag als angenommen markiert.
        </p>
      )}

      <form className="editor" onSubmit={submit}>
        <div className="box">
          <h2>Laden</h2>
          <div className="grid-2">
            <label className="field">
              <span>Name *</span>
              <input type="text" required maxLength={80} value={form.name} onChange={onName} />
            </label>
            <label className="field">
              <span>URL-Name *</span>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug')(e)
                }}
              />
              <span className="hint">/laden/{form.slug || '…'}</span>
            </label>
            <label className="field">
              <span>Adresse *</span>
              <input type="text" required maxLength={160} value={form.address} onChange={set('address')} />
            </label>
            <label className="field">
              <span>Stadtteil</span>
              <input type="text" maxLength={60} value={form.district} onChange={set('district')} />
            </label>
          </div>
          <label className="field">
            <span>
              Google-Maps-Link * <span className="hint">(darüber wird navigiert)</span>
            </span>
            <input
              type="url"
              required
              placeholder="https://maps.app.goo.gl/… oder https://www.google.com/maps/place/…"
              value={form.mapsUrl}
              onChange={onMapsUrl}
            />
            {hint && <span className="hint">{hint}</span>}
          </label>
          <div className="grid-3">
            <label className="field">
              <span>Breitengrad *</span>
              <input type="text" inputMode="decimal" value={form.lat} onChange={set('lat')} />
            </label>
            <label className="field">
              <span>Längengrad *</span>
              <input type="text" inputMode="decimal" value={form.lng} onChange={set('lng')} />
            </label>
            <label className="field">
              <span>Dönerpreis in €</span>
              <input type="text" inputMode="decimal" placeholder="7,50" value={form.doenerPrice} onChange={set('doenerPrice')} />
            </label>
          </div>
          <p className="hint">In die Karte klicken oder den Pin ziehen, um die Position zu setzen.</p>
          <MiniMap
            lat={lat}
            lng={lng}
            height={300}
            onPick={(p) => setForm((f) => ({ ...f, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) }))}
          />
          <label className="field">
            <span>
              Notiz <span className="hint">(öffentlich, z. B. „nur Barzahlung“ oder „So. zu“)</span>
            </span>
            <textarea rows={2} maxLength={300} value={form.notes} onChange={set('notes')} />
          </label>
        </div>

        <div className="box">
          <h2>Dein Urteil</h2>
          <p className="hint">Leer lassen, wenn du noch nicht da warst. Sonst alle Kriterien setzen.</p>
          <ScoreInputs criteria={criteria} value={scores} onChange={setScores} />
          <p className="preview">
            Macht insgesamt: <Score value={complete ? ratingOverall(scores, criteria) : null} />{' '}
            {hasScores && (
              <button type="button" className="linkish small" onClick={() => setScores({})}>
                Werte leeren
              </button>
            )}
          </p>
          <label className="field">
            <span>Fazit</span>
            <textarea rows={5} maxLength={2000} value={fazit} onChange={(e) => setFazit(e.target.value)} />
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button className="btn primary" disabled={pending}>
            {shop ? 'Speichern' : 'Laden anlegen'}
          </button>
          <Link className="btn" href={shop ? `/laden/${shop.slug}` : '/admin'}>
            Abbrechen
          </Link>
          {shop && (
            <button type="button" className="btn red push-right" onClick={remove} disabled={pending}>
              Laden löschen
            </button>
          )}
        </div>
      </form>
    </>
  )
}
