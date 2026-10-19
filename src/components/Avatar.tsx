import { nameOf } from '@/lib/format'

type Person = { username?: string; displayName?: string | null; avatarUrl?: string | null } | null | undefined

/** Profilbild, ohne Bild die Initialen auf einer Farbe, die zum Namen gehört */
export function Avatar({ person, size = 32 }: { person: Person; size?: number }) {
  const name = nameOf(person)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (person?.avatarUrl) {
    return <img className="avatar" src={person.avatarUrl} alt="" width={size} height={size} style={style} loading="lazy" />
  }
  const initials = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  const hue = [...(person?.username ?? name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)
  return (
    <span className="avatar avatar-initials" style={{ ...style, background: `hsl(${hue} 45% 78%)` }} aria-hidden="true">
      {initials || '?'}
    </span>
  )
}
