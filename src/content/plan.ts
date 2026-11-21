import type { TrackId } from './types.ts'

/** A suggested 12-week journey at 5-10 minutes a day. The learner can always pick another focus. */
export interface PlanWeek {
  week: number
  title: string
  titleBg: string
  focus: TrackId
  also?: TrackId
  goal: string
}

export const PLAN: PlanWeek[] = [
  { week: 1, title: 'Letters and first words', titleBg: 'Букви и първи думи', focus: 'azbuka', also: 'basics', goal: 'Read the first two units of letters and say hello properly.' },
  { week: 2, title: 'Sweet words for her', titleBg: 'Мили думи за нея', focus: 'love', also: 'azbuka', goal: 'Tell her you love and miss her, and mean it in Bulgarian.' },
  { week: 3, title: 'What the kids need', titleBg: 'Какво искат децата', focus: 'kids', also: 'azbuka', goal: 'Handle food, drinks and bedtime in Bulgarian.' },
  { week: 4, title: 'Everyday Bulgarian', titleBg: 'Всеки ден', focus: 'basics', also: 'grammar', goal: 'Small talk, numbers and the verb "to be".' },
  { week: 5, title: 'Helping at home', titleBg: 'Помощ вкъщи', focus: 'home', also: 'love', goal: 'Offer help, cook together, write the shopping list.' },
  { week: 6, title: 'The in-laws', titleBg: 'Семейството', focus: 'family', also: 'grammar', goal: 'Win over your тъща at the dinner table.' },
  { week: 7, title: 'Compliments and dates', titleBg: 'Комплименти и срещи', focus: 'love', also: 'out', goal: 'Plan a date night and order dinner in Bulgarian.' },
  { week: 8, title: 'Play, bath and bed', titleBg: 'Игра, баня и сън', focus: 'kids', also: 'grammar', goal: 'Run the evening routine in Bulgarian.' },
  { week: 9, title: 'Want, can, must', titleBg: 'Искам, мога, трябва', focus: 'grammar', also: 'basics', goal: 'Build your own sentences with да and ще.' },
  { week: 10, title: 'Out and about', titleBg: 'Навън', focus: 'out', also: 'family', goal: 'Café, market, taxi and a trip to the village.' },
  { week: 11, title: 'Holidays and memories', titleBg: 'Празници и спомени', focus: 'family', also: 'love', goal: 'Name days, toasts and talking about us.' },
  { week: 12, title: 'Bring it all together', titleBg: 'Всичко заедно', focus: 'basics', also: 'kids', goal: 'Finish open units, replay conversations, clear your mistakes.' },
]

/** Answers "has he finished at least one unit of this track?". Set by the app from his progress. */
let unitDone: ((track: TrackId) => boolean) | null = null
export function setPlanProgressCheck(check: ((track: TrackId) => boolean) | null) {
  unitDone = check
}

export interface PlanStatus {
  /** The plan week to work on. */
  week: PlanWeek
  /** The week by the calendar alone (1-based). */
  calendarWeek: number
  /** The calendar has moved on, but the plan waits for a finished unit in this week's track. */
  held: boolean
}

/**
 * Which plan week the learner is in. The calendar sets the pace, but the plan never runs more
 * than one week ahead of his progress: it only moves past a week once that week's track has at
 * least one finished unit. A slow or lapsed learner keeps working on the track he is in instead
 * of being dropped into a fresh, untouched one.
 */
export function planStatus(startedAt: number, now = Date.now()): PlanStatus {
  const calendarIdx = Math.min(PLAN.length - 1, Math.max(0, Math.floor((now - startedAt) / (7 * 86_400_000))))
  let idx = calendarIdx
  if (unitDone) {
    let firstOpen = 0
    while (firstOpen < calendarIdx && unitDone(PLAN[firstOpen].focus)) firstOpen++
    idx = Math.min(calendarIdx, firstOpen)
  }
  return { week: PLAN[idx], calendarWeek: calendarIdx + 1, held: idx < calendarIdx }
}

/** The plan week to work on (see planStatus). */
export function planWeek(startedAt: number, now = Date.now()): PlanWeek {
  return planStatus(startedAt, now).week
}
