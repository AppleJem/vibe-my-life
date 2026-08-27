import { useEffect, useState } from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  isConfirming?: boolean
  /** Shown in place of `confirmLabel` while the action is in flight. */
  confirmingLabel?: string
  /**
   * Holds the confirm button disabled for this long after the dialog opens, counting down in
   * its label. For decisions that should not be dismissible by reflex — marking a slip on an
   * avoid habit is the one this exists for. Omit for the usual instant confirm.
   */
  confirmDelayMs?: number
  /**
   * `danger` is the red destructive button this dialog was built for. `primary` is for
   * prompts that confirm something additive, like backfilling a habit day.
   */
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

const TONES = {
  danger: 'bg-red-500 hover:bg-red-400',
  primary: 'bg-pink-500 hover:bg-pink-400',
} as const

export function ConfirmDialog({ isOpen, ...props }: ConfirmDialogProps) {
  // The body is a separate component so it mounts fresh each time the dialog opens, which is
  // what resets `confirmDelayMs`: a countdown that survived a close would let the second
  // prompt be confirmed instantly.
  if (!isOpen) return null
  return <ConfirmDialogBody {...props} />
}

function ConfirmDialogBody({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isConfirming = false,
  confirmingLabel = 'Deleting…',
  confirmDelayMs,
  tone = 'danger',
  onConfirm,
  onCancel,
}: Omit<ConfirmDialogProps, 'isOpen'>) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    confirmDelayMs ? Math.ceil(confirmDelayMs / 1000) : 0
  )

  useEffect(() => {
    if (!confirmDelayMs) return

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [confirmDelayMs])

  const waiting = secondsLeft > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-zinc-100 font-semibold">{title}</p>
        {message && <p className="mt-1 text-sm text-zinc-400">{message}</p>}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming || waiting}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${TONES[tone]}`}
          >
            {isConfirming ? confirmingLabel : waiting ? `${confirmLabel} (${secondsLeft})` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
