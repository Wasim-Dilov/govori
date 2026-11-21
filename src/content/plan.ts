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

/** Which plan week the learner is in, counted from the day they started. */
export function planWeek(startedAt: number, now = Date.now()): PlanWeek {
  const week = Math.floor((now - startedAt) / (7 * 86_400_000))
  return PLAN[Math.min(PLAN.length - 1, Math.max(0, week))]
}
