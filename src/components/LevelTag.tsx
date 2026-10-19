import type { Level, Rank } from '@/lib/levels'

export function LevelTag({ level }: { level: Level }) {
  return (
    <span className={`level-tag level-${level.level}`} title={`Stufe ${level.level}`}>
      {level.name}
    </span>
  )
}

/** Rang mit XP und Balken bis zur nächsten Stufe */
export function LevelProgress({ rank }: { rank: Rank }) {
  return (
    <div className="level-progress">
      <p>
        <LevelTag level={rank.level} /> <b>{rank.xp} XP</b>
        <span className="muted small">
          {rank.next ? ` · noch ${rank.next.min - rank.xp} XP bis ${rank.next.name}` : ' · höchste Stufe erreicht'}
        </span>
      </p>
      <span className="level-bar" aria-hidden="true">
        <i style={{ width: `${Math.round(rank.progress * 100)}%` }} />
      </span>
    </div>
  )
}
