import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import axios from 'axios'
import { BigCheckBox } from '../../../components/Habits/BigCheckBox'
import { SlipButton } from '../../../components/Habits/SlipButton'
import { CountEditor } from '../../../components/Habits/CountEditor'
import { DurationEditor } from '../../../components/Habits/DurationEditor'
import { HabitHeatmap } from '../../../components/Habits/HabitHeatmap'
import { HistoryList } from '../../../components/Habits/HistoryList'
import { HabitForm } from '../../../components/Habits/HabitForm'
import { ActionListEditor } from '../../../components/Habits/ActionListEditor'
import { ExerciseMode } from '../../../components/Habits/ExerciseMode'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { accentOf } from '../../../constants/habitColors'
import { useActionList, useHabit } from '../../../hooks/useHabits'
import { localToday } from '../../../utils/recurring'
import {
  cleanStreak,
  currentStreak,
  formatShortDate,
  longestCleanStreak,
  longestStreak,
  polarityOf,
  startDateOf,
} from '../../../utils/habit'
import { playCompletionKlang } from '../../../utils/sounds'
import type { CreateCompletionInput, CreateHabitInput } from '../../../types/habit'

export const Route = createFileRoute('/_authenticated/habits/$habitId')({
  component: HabitDetailPage,
})

function HabitDetailPage() {
  const { habitId } = Route.useParams()
  const navigate = useNavigate()
  const {
    habit,
    completions,
    loading,
    notFound,
    log,
    unlog,
    editCompletion,
    updateHabit,
    deleteHabit,
  } = useHabit(habitId)

  const {
    actionList,
    items: actions,
    hasActions,
    saveActions,
    deleteActions,
  } = useActionList(habitId)

  const [isEditing, setIsEditing] = useState(false)
  /** The action-list editor, which replaces the page the same way `isEditing` does. */
  const [isEditingActions, setIsEditingActions] = useState(false)
  /** The full-screen routine runner. */
  const [isExercising, setIsExercising] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  /**
   * The day the open value editor is logging for — today from the big check box, or an
   * older day picked out of the heatmap. Null means no editor is open.
   */
  const [editorDate, setEditorDate] = useState<string | null>(null)
  /** A heatmap day waiting on the backfill confirmation. */
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  /**
   * Today, waiting on the deliberately slow confirmation an avoid habit's slip goes through.
   * Kept apart from `pendingDate` because the two prompts differ in wording and in friction.
   */
  const [pendingSlip, setPendingSlip] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  const today = localToday()
  const [isDone, setIsDone] = useState<boolean>(
    completions.some((completion) => completion.date === today)
  )
  const editorOpen = editorDate !== null

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
  // An avoid habit's completions are slips, not successes — the page reads the same data
  // upside down from here on.
  const isAvoid = polarityOf(habit) === 'avoid'

  const submitLog = async (input: Omit<CreateCompletionInput, 'date'>, date: string) => {
    setIsSaving(true)
    setLogError(null)
    try {
      await log({ date, ...input })
      setEditorDate(null)
    } catch (err) {
      // A 409 means another tab (or a stale render) already logged that day — worth
      // saying plainly rather than as a generic failure, since the box is about to
      // go inert and look like it worked.
      const verb = isAvoid ? 'marked' : 'logged'
      const already =
        date === today
          ? `Already ${verb} for today.`
          : `Already ${verb} for ${formatShortDate(date)}.`
      setLogError(
        axios.isAxiosError(err) && err.response?.status === 409
          ? already
          : 'Could not save that. Try again.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  /** Boolean habits log immediately; the other two need a value first. */
  const beginLog = (date: string) => {
    // The optimistic flip is today's box only — backfilling an older day must not
    // make today read as done.
    if (date === today) setIsDone(true)

    if (habit.type === 'boolean') {
      void submitLog({}, date)
      return
    }
    setLogError(null)
    setEditorDate(date)
  }

  const handleHoldComplete = () => beginLog(today)

  /** No klang here, unlike the two paths below — a slip is not something to celebrate. */
  const handleConfirmSlip = () => {
    beginLog(today)
    setPendingSlip(false)
  }

  const handleConfirmBackdate = () => {
    if (!pendingDate) return
    // Same order as the big check box: the reward sound fires on the commitment, not
    // on the round trip, so a count habit hears it as its editor opens. Backfilling a slip
    // stays silent for the same reason marking today's does.
    if (!isAvoid) playCompletionKlang()
    beginLog(pendingDate)
    setPendingDate(null)
  }

  const handleSaveEdits = async (input: CreateHabitInput) => {
    setIsSaving(true)
    try {
      await updateHabit(input)
      setIsEditing(false)
    } catch (err) {
      console.error('Error updating habit:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchiveHabit = async () => {
    const next = !habit.archived
    await updateHabit({ archived: next })
    // Archiving takes the habit off the list, so land back there; unarchiving stays put.
    if (next) navigate({ to: '/habits' })
    else setIsEditing(false)
  }

  const handleDeleteHabit = async () => {
    await deleteHabit()
    navigate({ to: '/habits' })
  }

  if (isEditingActions) {
    return (
      <ActionListEditor
        habit={habit}
        items={actions}
        hasStored={actionList !== null}
        onSave={saveActions}
        onDelete={deleteActions}
        onClose={() => setIsEditingActions(false)}
      />
    )
  }

  if (isEditing) {
    return (
      <HabitForm
        habit={habit}
        isSaving={isSaving}
        onSave={handleSaveEdits}
        onArchive={handleArchiveHabit}
        onDelete={handleDeleteHabit}
        onClose={() => setIsEditing(false)}
      />
    )
  }

  // Same three slots either way, but an avoid habit counts clean days and slips rather than
  // completions: "42 clean, 0 slips" is what someone who quit smoking wants to read.
  const startDate = startDateOf(habit)
  const streak = isAvoid ? cleanStreak(completions, today, startDate) : currentStreak(completions, today)
  const best = isAvoid ? longestCleanStreak(completions, today, startDate) : longestStreak(completions)

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

        {habit.archived && (
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
            Archived
          </span>
        )}

        <button
          onClick={() => setIsEditingActions(true)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1"
          aria-label={hasActions ? 'Edit action list' : 'Add an action list'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </button>

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

      {isAvoid ? (
        <SlipButton
          habit={habit}
          isSlipped={isDone}
          isSaving={isSaving}
          onPress={() => setPendingSlip(true)}
        />
      ) : (
        <BigCheckBox
          habit={habit}
          isDone={isDone}
          isSaving={isSaving && !editorOpen}
          onHoldComplete={handleHoldComplete}
        />
      )}

      {logError && <p className="text-center text-sm text-red-400 -mt-2 mb-4">{logError}</p>}

      {/* Hidden entirely when the habit has no routine — most habits are one action, and a
          button that opens an empty runner would be worse than no button. */}
      {hasActions && (
        <button
          onClick={() => setIsExercising(true)}
          style={accent.solid}
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-zinc-950 mb-6 flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 3.3A1 1 0 004.8 4.1v11.8a1 1 0 001.5.86l9.5-5.9a1 1 0 000-1.72l-9.5-5.9z" />
          </svg>
          Start exercise · {actions.length} steps
        </button>
      )}

      <div className="flex justify-center gap-6 text-center mb-8">
        <Stat label={isAvoid ? 'clean' : 'streak'} value={streak} color={accent.hex} />
        <Stat label="best" value={best} />
        <Stat label={isAvoid ? 'slips' : 'total'} value={completions.length} />
      </div>

      <div className="space-y-8">
        {loading ? (
          <div className="h-24 bg-zinc-800 rounded-xl animate-pulse" />
        ) : (
          <HabitHeatmap
            habit={habit}
            completions={completions}
            today={today}
            onBackdate={setPendingDate}
          />
        )}

        {(habit.tags.length > 0 || habit.description) && (
          <section>
            {habit.tags.length > 0 && (
              <p style={accent.text} className="text-xs mb-2">
                {habit.tags.map((tag) => `#${tag}`).join(' ')}
              </p>
            )}
            {habit.description && (
              <p className="text-sm text-zinc-400 whitespace-pre-line">{habit.description}</p>
            )}
          </section>
        )}

        <HistoryList
          habit={habit}
          completions={completions}
          onDelete={unlog}
          onEdit={(timestamp, input) => editCompletion({ timestamp, input })}
        />
      </div>

      {/* The ten-second wait is the whole point: it makes marking a slip a decision rather
          than a reflex, and gives the ten seconds back as a chance to not need it. */}
      <ConfirmDialog
        isOpen={pendingSlip}
        tone="danger"
        title="Are you sure you want to do this?"
        message={`This marks today as a slip on ${habit.name} and ends your clean run.`}
        confirmLabel="Yes"
        confirmDelayMs={10_000}
        onConfirm={handleConfirmSlip}
        onCancel={() => setPendingSlip(false)}
      />

      {/* Backdating skips the countdown: it already costs a half-second hold plus this
          prompt, and ten seconds a day would make catching up on a bad week unbearable. */}
      <ConfirmDialog
        isOpen={pendingDate !== null}
        tone={isAvoid ? 'danger' : 'primary'}
        title={
          isAvoid
            ? `Mark ${pendingDate ? formatShortDate(pendingDate) : ''} as a slip?`
            : `Log ${habit.name} for ${pendingDate ? formatShortDate(pendingDate) : ''}?`
        }
        message={
          isAvoid
            ? 'This records a slip on that day.'
            : 'This backdates the completion to that day.'
        }
        confirmLabel={isAvoid ? 'Yes, mark it' : 'Yes, log it'}
        onConfirm={handleConfirmBackdate}
        onCancel={() => setPendingDate(null)}
      />

      {isExercising && (
        <ExerciseMode habit={habit} items={actions} onClose={() => setIsExercising(false)} />
      )}

      {editorOpen && habit.type === 'count' && (
        <CountEditor
          habit={habit}
          isSaving={isSaving}
          onConfirm={(count, notes) => void submitLog({ count, notes }, editorDate!)}
          onCancel={() => setEditorDate(null)}
        />
      )}

      {editorOpen && habit.type === 'duration' && (
        <DurationEditor
          habit={habit}
          isSaving={isSaving}
          onConfirm={(durationMinutes, notes) =>
            void submitLog({ durationMinutes, notes }, editorDate!)
          }
          onCancel={() => setEditorDate(null)}
        />
      )}
    </>
  )
}

/** `color` is the habit's accent hex; the neutral stats leave it off. */
function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <p style={color ? { color } : undefined} className={`text-2xl font-bold ${color ? '' : 'text-zinc-300'}`}>
        {value}
      </p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}
