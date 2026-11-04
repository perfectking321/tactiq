/**
 * Injury map model - pure functions (no React) so it can be sanity-checked in node.
 * Muscle names are the react-body-highlighter vocabulary (MuscleType in its metadata.ts).
 * Used by the single-figure injury map (BodyMap.jsx).
 *
 * parseInjury('Right knee') ->
 *   { regions: [{ id: 'knee', group: 'knees', muscles: ['knees'], side: 'right' }],
 *     groups: ['knees'], muscles: ['knees'], side: 'right', matched: true }
 */

/**
 * Body areas the parser can place. view = which react-body-highlighter Model shows it best
 * ('anterior' | 'posterior'); tip = one short, non-diagnostic line for the hover card.
 */
export const GROUPS = [
  { id: 'shoulders', label: 'Shoulders', view: 'anterior', tip: 'Ease overhead smashes and serves; add light band rotator-cuff work. See a physio if pain rises.' },
  { id: 'back', label: 'Back', view: 'posterior', tip: 'Avoid heavy lifting and deep lunges; keep gentle mobility. See a physio if pain rises or spreads.' },
  { id: 'chest', label: 'Chest', view: 'anterior', tip: 'Ease power shots and push-ups; stretch gently. See a doctor if pain is sharp or affects breathing.' },
  { id: 'arms', label: 'Arms', view: 'anterior', tip: 'Cut smash volume for now; light stretching and gradual loading. See a physio if pain rises.' },
  { id: 'core', label: 'Core', view: 'anterior', tip: 'Limit rotation-heavy drills; gentle core bracing only. See a physio if pain rises.' },
  { id: 'forearms', label: 'Forearms & wrists', view: 'anterior', tip: 'Relax your grip and ease smash volume; ice after play. See a physio if pain rises.' },
  { id: 'thighs', label: 'Quads', view: 'anterior', tip: 'Shorten sessions; stretch and strengthen gently. See a physio if pain rises.' },
  { id: 'hamstrings', label: 'Glutes & hamstrings', view: 'posterior', tip: 'Avoid sprints and deep lunges; gentle bridges and stretches. See a physio if pain rises.' },
  { id: 'knees', label: 'Knees', view: 'anterior', tip: 'Ease lunges and jumps; strengthen quads & glutes. See a physio if pain rises.' },
  { id: 'calves', label: 'Calves & ankles', view: 'posterior', tip: 'Cut jumps and fast footwork; do calf raises and wear supportive shoes. See a physio if pain rises.' },
  { id: 'hips', label: 'Hips & groin', view: 'anterior', tip: 'Avoid wide lunges and splits; gentle hip mobility and glute work. See a physio if pain rises.' },
  { id: 'neck', label: 'Head & neck', view: 'anterior', tip: 'Rest from play and avoid jerky movements. See a doctor if pain or headaches persist.' },
]

/** Muscles each library view actually draws (from react-body-highlighter assets). */
export const VIEW_MUSCLES = {
  anterior: ['abductors', 'abs', 'biceps', 'calves', 'chest', 'forearm', 'front-deltoids', 'head', 'knees', 'neck', 'obliques', 'quadriceps', 'triceps'],
  posterior: ['adductor', 'back-deltoids', 'calves', 'forearm', 'gluteal', 'hamstring', 'head', 'knees', 'left-soleus', 'lower-back', 'right-soleus', 'trapezius', 'triceps', 'upper-back'],
}

export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]))

/** The library has only one sided part (soleus, back view, person's side). */
const SIDED = { soleus: { left: ['left-soleus'], right: ['right-soleus'], both: ['left-soleus', 'right-soleus'] } }

// Ordered: more specific phrases first. Each match is blanked out of the segment so later,
// broader rules ("back", "arm") cannot re-match the same words.
// [regex, region name, group id, library muscles | sided key]
const RULES = [
  [/\b(lower back|low back|lumbar)\b/g, 'lower back', 'back', ['lower-back']],
  [/\b(upper back|thoracic|trapezius|traps?|shoulder blades?|scapulae?)\b/g, 'upper back', 'back', ['upper-back', 'trapezius']],
  [/\bback\b/g, 'back', 'back', ['lower-back', 'upper-back']],
  [/\b(rotator cuff|shoulders?|delts?|deltoids?)\b/g, 'shoulder', 'shoulders', ['front-deltoids', 'back-deltoids']],
  [/\b((tennis|golfer'?s?) elbows?|elbows?)\b/g, 'elbow', 'forearms', ['forearm']],
  [/\b(forearms?|wrists?|hands?|fingers?|thumbs?)\b/g, 'wrist / forearm', 'forearms', ['forearm']],
  [/\b(biceps?)\b/g, 'biceps', 'arms', ['biceps']],
  [/\b(triceps?)\b/g, 'triceps', 'arms', ['triceps']],
  [/\b(arms?)\b/g, 'arm', 'arms', ['biceps', 'triceps']],
  [/\b(chest|pecs?|pectorals?|ribs?|sternum)\b/g, 'chest', 'chest', ['chest']],
  [/\b(obliques?|side strain)\b/g, 'obliques', 'core', ['obliques']],
  [/\b(abs|abdomen|abdominal\w*|core|stomach)\b/g, 'abdomen', 'core', ['abs', 'obliques']],
  [/\b(glutes?|gluteal|buttocks?)\b/g, 'glutes', 'hamstrings', ['gluteal']],
  [/\b(groin|adductors?|hip flexors?|hips?)\b/g, 'hip / groin', 'hips', ['abductors', 'adductor']],
  [/\b(hamstrings?|hammies)\b/g, 'hamstring', 'hamstrings', ['hamstring']],
  [/\b(quads?|quadriceps|thighs?)\b/g, 'thigh', 'thighs', ['quadriceps']],
  [/\b(knees?|patell\w*|acl|mcl|pcl|lcl|menisc\w*)\b/g, 'knee', 'knees', ['knees']],
  [/\b(achilles|ankles?|feet|foot|heels?|plantar\w*|toes?)\b/g, 'ankle / foot', 'calves', 'soleus'],
  [/\b(calf|calves|shins?|soleus)\b/g, 'calf', 'calves', ['calves']],
  [/\b(neck|cervical)\b/g, 'neck', 'neck', ['neck', 'trapezius']],
  [/\b(head|concussion)\b/g, 'head', 'neck', ['head']],
]

/** Midline regions: they have no left/right. */
const CENTRE = new Set(['lower back', 'upper back', 'back', 'chest', 'abdomen', 'neck', 'head'])

const SIDE_RE = /\b(left|right|both|bilateral|lt|rt|l|r)\b/g
const PLURAL_RE = /\b(ankles|feet|knees|shoulders|wrists|hips|elbows|calves|hamstrings|quads|thighs)\b/

function sideOf(segment) {
  const words = segment.match(SIDE_RE) ?? []
  if (!words.length) return null
  let left = false
  let right = false
  for (const w of words) {
    if (w === 'both' || w === 'bilateral') return 'both'
    if (w === 'left' || w === 'lt' || w === 'l') left = true
    else right = true
  }
  return left && right ? 'both' : left ? 'left' : 'right'
}

const mergeSide = (a, b) => (!a ? b : !b ? a : a === b ? a : 'both')
const uniq = (xs) => [...new Set(xs)]

export function parseInjury(text) {
  const empty = { regions: [], groups: [], muscles: [], side: null, matched: false }
  if (!text || typeof text !== 'string') return empty
  const segments = text.toLowerCase().split(/,|;|\/|&|\band\b|\+/)
  const found = new Map() // region name -> region
  let pendingSide = null // "left and right knee": a side-only segment carries over to the next one
  let lastSide = null // "right achilles / calf": an unsided segment inherits the previous side

  for (const raw of segments) {
    let seg = ` ${raw.trim()} `
    const plural = PLURAL_RE.test(seg) ? 'both' : null
    const segSide = mergeSide(pendingSide, sideOf(seg)) ?? plural ?? lastSide
    const hits = []
    for (const [re, id, group, muscles] of RULES) {
      re.lastIndex = 0
      if (re.test(seg)) {
        hits.push({ id, group, muscles })
        re.lastIndex = 0
        seg = seg.replace(re, ' ')
      }
    }
    if (!hits.length) {
      pendingSide = sideOf(` ${raw} `) ? segSide : null
      continue
    }
    pendingSide = null
    lastSide = segSide
    for (const h of hits) {
      const side = CENTRE.has(h.id) ? null : segSide ?? 'both'
      const prev = found.get(h.id)
      found.set(h.id, { ...h, side: prev ? mergeSide(prev.side, side) : side })
    }
  }

  const regions = [...found.values()].map((r) => ({
    id: r.id,
    group: r.group,
    side: r.side,
    muscles: typeof r.muscles === 'string' ? SIDED[r.muscles][r.side ?? 'both'] : r.muscles,
  }))
  if (!regions.length) return empty
  const sided = regions.filter((r) => r.side)
  return {
    regions,
    groups: uniq(regions.map((r) => r.group)),
    muscles: uniq(regions.flatMap((r) => r.muscles)),
    side: sided.length ? sided.map((r) => r.side).reduce(mergeSide) : null,
    matched: true,
  }
}

/** Views that show the injury, in the order its regions were typed. Empty when nothing matched. */
export function injuryViews(parsed) {
  return uniq(parsed.regions.map((r) => GROUP_BY_ID[r.group].view))
}

/** Injured muscles the given view can draw. */
export function musclesInView(parsed, view) {
  return parsed.muscles.filter((m) => VIEW_MUSCLES[view].includes(m))
}

/** One-line general tip for the first placed region shown in `view` (any view if omitted); null when nothing matched. */
export function tipFor(parsed, view) {
  const r = parsed.regions.find((x) => !view || GROUP_BY_ID[x.group].view === view) ?? parsed.regions[0]
  return r ? GROUP_BY_ID[r.group].tip : null
}

/** "Right knee" - the profile text as typed, first letter capitalised. */
export const displayPart = (text) => (text ? text.trim().charAt(0).toUpperCase() + text.trim().slice(1) : '')

/** "right knee, lower back" - for aria labels. */
export function describeRegions(parsed) {
  return parsed.regions
    .map((r) => (!r.side ? r.id : r.side === 'both' ? `${r.id} (both sides)` : `${r.side} ${r.id}`))
    .join(', ')
}
