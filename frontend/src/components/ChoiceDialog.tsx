export interface DialogChoice<K extends string = string> {
  key: K
  label: string
  description?: string
  /** `danger` paints the row red; everything else is neutral. */
  tone?: 'default' | 'danger'
}

interface ChoiceDialogProps<K extends string> {
  isOpen: boolean
  title: string
  message?: string
  choices: DialogChoice<K>[]
  isBusy?: boolean
  onSelect: (key: K) => void
  onCancel: () => void
}

/**
 * A stacked list of options, for the questions that have more than two answers —
 * "does this edit apply to one occurrence, or all of them?".
 *
 * Kept separate from `ConfirmDialog`, which is a two-button destructive prompt with its
 * own hard-coded red confirm and "Deleting…" busy text.
 */
export function ChoiceDialog<K extends string>({
  isOpen,
  title,
  message,
  choices,
  isBusy = false,
  onSelect,
  onCancel,
}: ChoiceDialogProps<K>) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
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

        <div className="mt-4 flex flex-col gap-2">
          {choices.map((choice) => (
            <button
              key={choice.key}
              onClick={() => onSelect(choice.key)}
              disabled={isBusy}
              className={`rounded-xl px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                choice.tone === 'danger'
                  ? 'bg-red-500/10 hover:bg-red-500/20'
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              <span
                className={`block text-sm font-semibold ${
                  choice.tone === 'danger' ? 'text-red-400' : 'text-zinc-100'
                }`}
              >
                {choice.label}
              </span>
              {choice.description && (
                <span className="mt-0.5 block text-xs text-zinc-500">{choice.description}</span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          disabled={isBusy}
          className="mt-4 w-full rounded-xl py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 disabled:opacity-50"
        >
          {isBusy ? 'Saving…' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
