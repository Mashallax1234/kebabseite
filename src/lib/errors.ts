/**
 * Fehler, deren Meldung dem Nutzer gezeigt werden darf (z. B. "Passwort falsch").
 * Alle anderen Fehler landen nur im Server-Log, nach außen geht eine
 * allgemeine Meldung – so verraten wir keine Interna (SQL, Pfade, Stacktraces).
 */
export class UserError extends Error {
  name = 'UserError'
}
