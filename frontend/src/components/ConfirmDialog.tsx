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

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isConfirming = false,
  confirmingLabel = 'Deleting…',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

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
            disabled={isConfirming}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${TONES[tone]}`}
          >
            {isConfirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
