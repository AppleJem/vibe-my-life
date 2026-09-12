import { useState } from 'react'
import { VoiceRecorderButton } from '../VoiceRecorderButton'
import { voiceApi } from '../../services/api'

interface DescriptionFieldProps {
  value: string
  onChange: (description: string) => void
  placeholder?: string
}

/**
 * The notes on a climb, typed or spoken.
 *
 * Dictation goes through `/voice/transcribe`, which stops after Whisper — no LLM pass, no
 * structure inferred. What you said is what lands in the field, which is the right
 * behaviour for beta notes ("heel hook on the volume, fell at the last move") where any
 * interpretation would be a lossy guess.
 *
 * A transcript is appended rather than replacing, so recording twice adds to the note and a
 * failed round trip can never eat what was already typed.
 */
export function DescriptionField({ value, onChange, placeholder }: DescriptionFieldProps) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRecording = async (audioBlob: Blob) => {
    setRecording(false)
    setTranscribing(true)
    setError(null)

    try {
      const transcript = (await voiceApi.transcribe(audioBlob)).trim()
      if (transcript) {
        onChange(value.trim() ? `${value.trim()} ${transcript}` : transcript)
      }
    } catch {
      setError("Couldn't transcribe that — try again?")
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'How did it go?'}
          rows={2}
          className="w-full px-3 py-2 pr-11 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 resize-y focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
        />

        <button
          type="button"
          onClick={() => setRecording(true)}
          disabled={transcribing}
          aria-label="Dictate a description"
          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          {transcribing ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 border-t-emerald-400 animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0M12 18v3m0-3a4 4 0 004-4V7a4 4 0 10-8 0v7a4 4 0 004 4z" />
            </svg>
          )}
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {recording && (
        <VoiceRecorderButton
          onRecordingComplete={handleRecording}
          onCancel={() => setRecording(false)}
        />
      )}
    </div>
  )
}
