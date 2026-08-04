import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import axios from 'axios'
import { BigCheckBox } from '../../../components/Habits/BigCheckBox'
import { CountEditor } from '../../../components/Habits/CountEditor'
import { DurationEditor } from '../../../components/Habits/DurationEditor'
import { HabitHeatmap } from '../../../components/Habits/HabitHeatmap'
import { HistoryList } from '../../../components/Habits/HistoryList'
import { HabitForm } from '../../../components/Habits/HabitForm'
import { accentOf } from '../../../constants/habitColors'
import { useHabit } from '../../../hooks/useHabits'
import { localToday } from '../../../utils/recurring'
import { currentStreak, longestStreak } from '../../../utils/habit'
import type { CreateCompletionInput, CreateHabitInput } from '../../../types/habit'

export const Route = createFileRoute('/_authenticated/habits/$habitId')({
  component: HabitDetailPage,
})

function HabitDetailPage() {
  const { habitId } = Route.useParams()
  const navigate = useNavigate()
  const { habit, completions, loading, notFound, log, unlog, updateHabit, deleteHabit } =
    useHabit(habitId)

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  /** Which value editor the hold opened, if any. */
  const [editorOpen, setEditorOpen] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  const today = localToday()

  if (notFound) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400">This habit no longer exists.</p>
        <button
          onClick={() => navigate({ to: '/habits' })}
          className="mt-4 text-sm text-pink-500"
        >
          Back to habits
        </button>
      </div>
    )
  }

  if (!habit) {
    return (
      <div className="space-y-4">
        <div className="h-56 bg-zinc-800 rounded-[2rem] animate-pulse" />
        <div className="h-24 bg-zinc-800 rounded-xl animate-pulse" />
      </div>
    )
  }

  const accent = accentOf(habit.color)
  const isDone = completions.some((completion) => completion.date === today)

  const submitLog = async (input: Omit<CreateCompletionInput, 'date'>) => {
    setIsSaving(true)
    setLogError(null)
    try {
      await log({ date: today, ...input })
      setEditorOpen(false)
    } catch (err) {
      // A 409 means another tab (or a stale render) already logged today — worth
      // saying plainly rather than as a generic failure, since the box is about to
      // go inert and look like it worked.
      setLogError(
        axios.isAxiosError(err) && err.response?.status === 409
          ? 'Already logged for today.'
          : 'Could not save that. Try again.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleHoldComplete = () => {
    if (habit.type === 'boolean') {
      void submitLog({})
      return
    }
    setLogError(null)
    setEditorOpen(true)
  }

  const handleSaveEdits = async (input: CreateHabitInput) => {
    setIsSaving(true)
    try {
      await updateHabit(input)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteHabit = async () => {
    await deleteHabit()
    navigate({ to: '/habits' })
  }

  if (isEditing) {
    return (
      <HabitForm
        habit={habit}
        isSaving={isSaving}
        onSave={handleSaveEdits}
        onDelete={handleDeleteHabit}
        onClose={() => setIsEditing(false)}
      />
    )
  }

  const streak = currentStreak(completions, today)
  const best = longestStreak(completions)

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: '/habits' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="flex-1 text-lg font-semibold text-zinc-100 truncate">{habit.name}</h2>

        <button
          onClick={() => setIsEditing(true)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1"
          aria-label="Edit habit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      <BigCheckBox
        habit={habit}
        isDone={isDone}
        isSaving={isSaving && !editorOpen}
        onHoldComplete={handleHoldComplete}
      />

      {logError && <p className="text-center text-sm text-red-400 -mt-2 mb-4">{logError}</p>}

      <div className="flex justify-center gap-6 text-center mb-8">
        <Stat label="streak" value={streak} accent={accent.text} />
        <Stat label="best" value={best} accent="text-zinc-300" />
        <Stat label="total" value={completions.length} accent="text-zinc-300" />
      </div>

      <div className="space-y-8">
        {loading ? (
          <div className="h-24 bg-zinc-800 rounded-xl animate-pulse" />
        ) : (
          <HabitHeatmap habit={habit} completions={completions} today={today} />
        )}

        {(habit.tags.length > 0 || habit.description) && (
          <section>
            {habit.tags.length > 0 && (
              <p className={`text-xs mb-2 ${accent.text}`}>
                {habit.tags.map((tag) => `#${tag}`).join(' ')}
              </p>
            )}
            {habit.description && (
              <p className="text-sm text-zinc-400 whitespace-pre-line">{habit.description}</p>
            )}
          </section>
        )}

        <HistoryList habit={habit} completions={completions} onDelete={unlog} />
      </div>

      {editorOpen && habit.type === 'count' && (
        <CountEditor
          habit={habit}
          isSaving={isSaving}
          onConfirm={(count, notes) => void submitLog({ count, notes })}
          onCancel={() => setEditorOpen(false)}
        />
      )}

      {editorOpen && habit.type === 'duration' && (
        <DurationEditor
          habit={habit}
          isSaving={isSaving}
          onConfirm={(durationMinutes, notes) => void submitLog({ durationMinutes, notes })}
          onCancel={() => setEditorOpen(false)}
        />
      )}
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}
