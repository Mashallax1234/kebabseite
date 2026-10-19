'use client'
import { useState, useTransition } from 'react'
import { updateAvatarAction, type ActionResult } from '@/app/actions'
import { compressImage } from '@/lib/compressImage'
import { AVATAR } from '@/lib/config'
import type { Profile } from '@/lib/data/types'
import { Avatar } from './Avatar'

export function AvatarEditor({ profile }: { profile: Profile }) {
  const [result, setResult] = useState<ActionResult>({})
  const [busy, setBusy] = useState(false)
  const [pending, start] = useTransition()

  function send(fd: FormData) {
    start(async () => setResult(await updateAvatarAction(fd)))
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // dieselbe Datei nochmal wählen können
    if (!file) return
    setResult({})
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('image', await compressImage(file, AVATAR), 'avatar.jpg')
      send(fd)
    } catch (err) {
      setResult({ error: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  function remove() {
    if (!confirm('Profilbild entfernen?')) return
    const fd = new FormData()
    fd.set('remove', '1')
    send(fd)
  }

  return (
    <div className="box narrow avatar-editor">
      <Avatar person={profile} size={96} />
      <div>
        <div className="actions">
          <label className="btn">
            {busy ? 'Wird zugeschnitten …' : pending ? 'Wird gespeichert …' : profile.avatarUrl ? 'Anderes Bild wählen' : 'Profilbild wählen'}
            <input type="file" accept="image/*" hidden disabled={busy || pending} onChange={onFile} />
          </label>
          {profile.avatarUrl && (
            <button type="button" className="linkish" disabled={pending} onClick={remove}>
              entfernen
            </button>
          )}
        </div>
        <p className="hint">Wird mittig quadratisch zugeschnitten und auf {AVATAR.maxSize} px verkleinert.</p>
        {result.error && <p className="error">{result.error}</p>}
        {result.ok && <p className="ok">{result.ok}</p>}
      </div>
    </div>
  )
}
