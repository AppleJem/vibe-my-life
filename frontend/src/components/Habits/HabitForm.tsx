import { useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import { GroupInput, TagInput } from './SuggestInput'
import { INPUT } from './fieldStyles'
import { ACCENTS, HABIT_EMOJIS, accentOf } from '../../constants/habitColors'
import { useHabitTaxonomy } from '../../hooks/useHabits'
import { normaliseTag } from '../../utils/habit'
import type { CreateHabitInput, Habit, HabitType } from '../../types/habit'

interface HabitFormProps {
  /** null is a blank create form. */
  habit: Habit | null
  isSaving: boolean
  onSave: (input: CreateHabitInput) => Promise<unknown>
  onDelete?: () => Promise<unknown>
  onClose: () => void
}

const TYPE_OPTIONS: { type: HabitType; label: string; hint: string }[] = [
  { type: 'boolean', label: 'Done', hint: 'Did it or didn’t' },
  { type: 'count', label: 'Count', hint: 'Pages, glasses, reps' },
  { type: 'duration', label: 'Time', hint: 'Minutes spent' },
]

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-600">{hint}</p>}
    </div>
  )
}

/**
 * Create and edit share one form. It replaces the page body rather than opening a modal,
 * the same in-place editor idiom the recurring settings page uses.
 */
export function HabitForm({ habit, isSaving, onSave, onDelete, onClose }: HabitFormProps) {
  const [name, setName] = useState(habit?.name ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? HABIT_EMOJIS[0])
  const [type, setType] = useState<HabitType>(habit?.type ?? 'boolean')
  const [unit, setUnit] = useState(habit?.unit ?? '')
  const [target, setTarget] = useState(habit?.target ? String(habit.target) : '')
  // Legacy tags may predate the lowercase rule, so normalise what's already stored.
  const [tags, setTags] = useState(() =>
    [...new Set((habit?.tags ?? []).map(normaliseTag).filter(Boolean))]
  )
  const [group, setGroup] = useState(habit?.group ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [color, setColor] = useState(habit?.color ?? ACCENTS[0].key)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const taxonomy = useHabitTaxonomy()
  const accent = accentOf(color)
  const canSave = name.trim().length > 0 && !isSaving

  const handleSave = async () => {
    const parsedTarget = Number(target)

    await onSave({
      name: name.trim(),
      emoji,
      type,
      description: description.trim(),
      // Both are meaningless on a boolean habit, and the server clears `unit` itself
      // when the type isn't `count` — sending them anyway would just be noise.
      ...(type === 'count' && unit.trim() && { unit: unit.trim() }),
      ...(type !== 'boolean' && parsedTarget > 0 && { target: parsedTarget }),
      tags,
      // Always sent: null is what clears the group on an edit, and the server drops it
      // rather than storing an empty attribute on a create.
      group: group.trim() || null,
      color,
    })
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">
          {habit ? 'Edit habit' : 'New habit'}
        </h2>
      </div>

      <Section label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Read before bed"
          autoFocus
          className={INPUT}
        />
      </Section>

      <Section label="Icon">
        <div className="grid grid-cols-8 gap-2">
          {HABIT_EMOJIS.map((option) => (
            <button
              key={option}
              onClick={() => setEmoji(option)}
              className={`aspect-square rounded-lg text-xl flex items-center justify-center transition-colors ${
                emoji === option ? `ring-2 ${accent.ring} bg-zinc-800` : 'bg-zinc-800/50 hover:bg-zinc-800'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </Section>

      <Section label="What gets recorded">
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => setType(option.type)}
              className={`px-2 py-3 rounded-lg text-center transition-colors ${
                type === option.type
                  ? `${accent.solid} text-zinc-950`
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="block text-[10px] opacity-80 mt-0.5">{option.hint}</span>
            </button>
          ))}
        </div>
      </Section>

      {type === 'count' && (
        <Section label="Unit" hint="What you're counting — pages, glasses, reps.">
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="pages"
            className={INPUT}
          />
        </Section>
      )}

      {type !== 'boolean' && (
        <Section
          label="Daily target (optional)"
          hint="When set, the heatmap shades each day against this instead of your best day."
        >
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            placeholder={type === 'duration' ? '20' : '10'}
            className={INPUT}
          />
        </Section>
      )}

      <Section label="Colour">
        <div className="flex gap-2">
          {ACCENTS.map((option) => (
            <button
              key={option.key}
              onClick={() => setColor(option.key)}
              aria-label={option.label}
              className={`w-9 h-9 rounded-full ${option.solid} ${
                color === option.key ? 'ring-2 ring-offset-2 ring-offset-zinc-950 ring-zinc-100' : ''
              }`}
            />
          ))}
        </div>
      </Section>

      <Section label="Group" hint="Habits in the same group are listed together.">
        <GroupInput value={group} suggestions={taxonomy.groups} onChange={setGroup} />
      </Section>

      <Section label="Tags" hint="Enter to add. Lowercase, no spaces.">
        <TagInput value={tags} suggestions={taxonomy.tags} onChange={setTags} />
      </Section>

      <Section label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why this matters"
          rows={3}
          className={`${INPUT} resize-none`}
        />
      </Section>

      {habit && onDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 py-3 text-sm font-medium text-red-400 hover:bg-zinc-800 mb-4"
        >
          Delete habit
        </button>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full rounded-xl py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40 ${accent.solid}`}
          >
            {isSaving ? 'Saving…' : habit ? 'Save changes' : 'Create habit'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this habit?"
        message="Its entire history goes with it. This can't be undone."
        isConfirming={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
