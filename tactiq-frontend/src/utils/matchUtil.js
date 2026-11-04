/** Client-side twin of the backend match rules (schemas.py parse_game_scores / normalise_scores). */

/** rows: [{ a: '21', b: '18' }, ...] (your points first). Returns { error, games, won, lost, pointsWon, pointsLost, decided }. */
export function evaluateGames(rows) {
  const filled = rows.filter((r) => r.a !== '' || r.b !== '')
  const out = { error: '', games: [], won: 0, lost: 0, pointsWon: 0, pointsLost: 0, decided: false }
  if (!filled.length) {
    out.error = 'Enter between 1 and 3 game scores, e.g. 21-18, 19-21, 21-15.'
    return out
  }
  for (const r of filled) {
    if (r.a === '' || r.b === '') {
      out.error = 'Fill in both scores for each game.'
      return out
    }
    const a = Number(r.a)
    const b = Number(r.b)
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      out.error = `'${r.a}-${r.b}' is not a score like 21-18.`
      return out
    }
    if (a > 30 || b > 30 || a === b) {
      out.error = `'${a}-${b}' is not a valid badminton game score.`
      return out
    }
    if (out.won === 2 || out.lost === 2) {
      out.error = 'The match was already decided before the last game - remove the extra game.'
      return out
    }
    out.games.push([a, b])
    out.pointsWon += a
    out.pointsLost += b
    if (a > b) out.won += 1
    else out.lost += 1
  }
  if (out.won !== 2 && out.lost !== 2) {
    out.error = 'A best-of-3 match needs a winner (2 games). Add the deciding game score.'
    return out
  }
  out.decided = true
  return out
}

/** Backend format: "21-18, 19-21, 21-15". */
export const toGameScores = (games) => games.map(([a, b]) => `${a}-${b}`).join(', ')

/** "21-18,19-21" -> [{a:'21', b:'18'}, ...] */
export function fromGameScores(str) {
  const rows = (str || '').split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [a, b] = p.split('-')
    return { a: a ?? '', b: b ?? '' }
  })
  return rows.length ? rows : [{ a: '', b: '' }]
}
