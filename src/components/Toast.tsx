import { AnimatePresence, motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { useApp } from '../lib/store.ts'

const style: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
  zIndex: 40,
  width: 'min(440px, calc(100vw - 32px))',
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--ink)',
  color: 'var(--linen)',
  boxShadow: 'var(--shadow-float)',
  font: '600 15px/20px var(--font-text)',
  textAlign: 'center',
}

/** A short, friendly message that slides up and fades away. */
export function Toast() {
  const toast = useApp((s) => s.toast)
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          role="status"
          aria-live="polite"
          style={style}
          initial={{ opacity: 0, y: 24, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 12, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        >
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
