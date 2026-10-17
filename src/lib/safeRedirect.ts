/**
 * Nur Pfade auf der eigenen Seite als Weiterleitungsziel zulassen.
 * Blockt "//evil.com", "/\evil.com", "https://…", Steuerzeichen usw.
 */
export function safeNext(v: string | null | undefined): string {
  if (!v || v.length > 300) return '/'
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\') || /[\u0000-\u001f]/.test(v)) return '/'
  try {
    // Muss auf derselben (Dummy-)Origin bleiben
    const u = new URL(v, 'http://x.invalid')
    if (u.origin !== 'http://x.invalid') return '/'
    return u.pathname + u.search
  } catch {
    return '/'
  }
}
