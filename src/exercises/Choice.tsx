import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { StudyItem } from '../content/index.ts'
import { speak } from '../lib/audio.ts'
import { Bg, Prompt, SpeakButton } from './common.tsx'
import type { ExerciseProps } from './types.ts'

type ChoiceType = 'mc_bg_en' | 'mc_en_bg' | 'listen_mc' | 'letter_sound' | 'sound_letter' | 'read_word'

/** All the "pick one of four" exercises share this component. */
export function ChoiceExercise({ ex, setAnswer, checked, translit }: ExerciseProps<ChoiceType>) {
  const [picked, setPicked] = useState<string | null>(null)
  const item = ex.item
  useEffect(() => setPicked(null), [ex])

  const choose = (opt: StudyItem) => {
    if (checked) return
    setPicked(opt.id)
    // Hearing the Bulgarian option when tapped helps the sound stick.
    if (ex.type === 'mc_en_bg' || ex.type === 'listen_mc') void speak(opt.bg, { itemId: opt.id })
    if (ex.type === 'sound_letter' && opt.letter) void speak(opt.letter.example.bg)
    const correct = opt.id === item.id
    setAnswer({
      correct,
      answer: labelOf(opt),
      solution: solutionOf(),
      solutionTr: ex.type === 'mc_bg_en' || ex.type === 'letter_sound' ? undefined : item.kind === 'letter' ? undefined : item.tr,
    })
  }

  const labelOf = (o: StudyItem) => (ex.type === 'mc_bg_en' ? o.en : ex.type === 'letter_sound' ? o.tr : ex.type === 'read_word' ? o.tr : o.bg)
  const solutionOf = () => {
    switch (ex.type) {
      case 'mc_bg_en':
        return item.en
      case 'letter_sound':
        return `${item.letter!.upper} sounds like "${item.tr}"`
      case 'sound_letter':
        return `${item.letter!.upper} ${item.letter!.lower}`
      case 'read_word':
        return `${item.bg} = ${item.tr} (${item.en})`
      default:
        return item.bg
    }
  }

  const stateOf = (o: StudyItem) => {
    if (!checked) return picked === o.id ? 'is-selected' : ''
    if (o.id === item.id) return 'is-correct'
    if (picked === o.id) return 'is-wrong'
    return 'is-dim'
  }

  // Picture cards only when the answer is English; English-to-Bulgarian options are text only.
  const cards = ex.type === 'mc_bg_en' && ex.cards

  // Keys 1-4 pick an answer (matches the number badges).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (checked || !Number.isInteger(n) || n < 1 || n > ex.options.length) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      choose(ex.options[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="ex">
      <Header ex={ex} translit={translit} />
      <div className={cards ? 'ex-grid' : 'ex-list'} role="group" aria-label="Answers">
        {ex.options.map((o, i) => (
          <motion.button
            key={o.id}
            type="button"
            className={`gv-choice ${cards ? 'gv-choice--card' : ''} ${stateOf(o)}`}
            onClick={() => choose(o)}
            disabled={!!checked}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 400, damping: 30 }}
          >
            {!cards && <span className="gv-choice__key">{i + 1}</span>}
            {cards && <span className="gv-choice__emoji">{o.emoji}</span>}
            <OptionLabel ex={ex} o={o} translit={translit} />
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function OptionLabel({ ex, o, translit }: { ex: ExerciseProps<ChoiceType>['ex']; o: StudyItem; translit: boolean }) {
  switch (ex.type) {
    case 'mc_bg_en':
      return <span className="gv-choice__text">{o.en}</span>
    case 'letter_sound':
      return (
        <span className="gv-choice__text">
          <span>"{o.tr}"</span>
          <span className="gv-choice__sub">{o.letter?.sound}</span>
        </span>
      )
    case 'sound_letter':
      return (
        <span className="gv-choice__text ex-optletter" lang="bg">
          {o.letter?.upper} {o.letter?.lower}
        </span>
      )
    case 'read_word':
      return (
        <span className="gv-choice__text">
          <span>{o.tr}</span>
          <span className="gv-choice__sub">{o.en}</span>
        </span>
      )
    case 'listen_mc':
      return (
        <span className="gv-choice__text">
          <span lang="bg">{o.bg}</span>
        </span>
      )
    default:
      return (
        <span className="gv-choice__text">
          <span lang="bg">{o.bg}</span>
          {translit && <span className="gv-choice__sub">{o.tr}</span>}
        </span>
      )
  }
}

function Header({ ex, translit }: { ex: ExerciseProps<ChoiceType>['ex']; translit: boolean }) {
  const item = ex.item
  switch (ex.type) {
    case 'mc_bg_en':
      return (
        <>
          <Prompt>What does this mean?</Prompt>
          <div className="ex-hero">
            <SpeakButton text={item.bg} itemId={item.id} auto />
            <Bg text={item.bg} tr={item.tr} showTr={translit} className="t-bg-word" />
          </div>
        </>
      )
    case 'mc_en_bg':
      return (
        <>
          <Prompt>How do you say this in Bulgarian?</Prompt>
          <div className="ex-hero ex-hero--en">
            <span className="ex-emoji">{item.emoji}</span>
            <span className="t-card-title">{item.en}</span>
          </div>
        </>
      )
    case 'listen_mc':
      return (
        <>
          <Prompt>What do you hear?</Prompt>
          <div className="ex-hero ex-hero--listen">
            <SpeakButton text={item.bg} itemId={item.id} size="lg" auto />
            <SpeakButton text={item.bg} itemId={item.id} slow />
          </div>
        </>
      )
    case 'letter_sound':
      return (
        <>
          <Prompt>Which sound does this letter make?</Prompt>
          <div className="ex-hero ex-hero--letter">
            <span className="t-letter ex-bigletter" lang="bg">
              {item.letter!.upper}
              {item.letter!.lower}
            </span>
          </div>
        </>
      )
    case 'sound_letter':
      return (
        <>
          <Prompt>Which letter makes this sound?</Prompt>
          <div className="ex-hero ex-hero--en">
            <span className="t-hero">"{item.tr}"</span>
            <span className="muted">{item.letter!.sound}</span>
          </div>
        </>
      )
    case 'read_word':
      return (
        <>
          <Prompt>Read this word</Prompt>
          <div className="ex-hero">
            <span className="t-bg-word ex-readword" lang="bg">
              {item.bg}
            </span>
          </div>
        </>
      )
  }
}
