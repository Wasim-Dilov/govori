import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BrandMark } from './BrandMark.tsx'
import type { CSSProperties } from 'react'
import { useApp } from '../lib/store.ts'

// An iOS-style capsule under the status bar, on a translucent material.
const style: CSSProperties = {
  position: 'fixed',
  left: '50%',
  top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
  zIndex: 40,
  width: 'max-content',
  maxWidth: 'min(420px, calc(100vw - 32px))',
  padding: '8px 16px 8px 8px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  borderRadius: 'var(--radius-full)',
  background: 'var(--material-thick)',
  WebkitBackdropFilter: 'saturate(180%) blur(30px)',
  backdropFilter: 'saturate(180%) blur(30px)',
  color: 'var(--ink)',
  boxShadow: 'var(--shadow-float), 0 0 0 var(--hairline) var(--separator)',
  font: '500 15px/20px var(--font-text)',
  textAlign: 'left',
  textWrap: 'balance',
}

/** A short, friendly message that drops in from the top and fades away. */
export function Toast() {
  const toast = useApp((s) => s.toast)
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          role="status"
          aria-live="polite"
          style={style}
          initial={reduce ? { opacity: 0, x: '-50%' } : { opacity: 0, y: -16, x: '-50%', scale: 0.96 }}
          animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
          exit={reduce ? { opacity: 0, x: '-50%' } : { opacity: 0, y: -10, x: '-50%', scale: 0.98 }}
          transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 500, damping: 40 }}
        >
          <BrandMark size={24} />
          <span>{toast.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
