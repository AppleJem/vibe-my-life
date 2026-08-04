import { useState, useRef, useCallback, useEffect } from 'react'
import { blobToWav } from '../../utils/audioToWav'

interface VoiceRecorderButtonProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onCancel: () => void
}

type RecordingState = 'idle' | 'requesting-permission' | 'recording' | 'processing'

export function VoiceRecorderButton({ onRecordingComplete, onCancel }: VoiceRecorderButtonProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cancelledRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const startRecording = useCallback(async () => {
    setState('requesting-permission')
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Determine supported MIME type - prefer ogg for better compatibility with Groq
      const mimeTypes = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      let mimeType = ''
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }
      console.log('Using MIME type:', mimeType || 'default')

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Cancelling also stops the recorder — don't upload what the user discarded
        if (cancelledRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          streamRef.current = null
          return
        }

        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        })

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        if (blob.size === 0) {
          setError('No audio recorded')
          setState('idle')
          return
        }

        // Transcode to WAV so the server always gets a format the ASR can parse.
        // If the browser can't decode its own recording, send the original.
        let upload = blob
        try {
          upload = await blobToWav(blob)
        } catch (err) {
          console.error('WAV conversion failed, sending original recording:', err)
        }

        onRecordingComplete(upload)
      }

      mediaRecorder.start()
      setState('recording')
      setDuration(0)

      // Start duration timer
      const startTime = Date.now()
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)

      // Vibrate for haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    } catch (err: any) {
      console.error('Failed to start recording:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please allow access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.')
      } else {
        setError('Failed to access microphone. Please try again.')
      }
      setState('idle')
    }
  }, [onRecordingComplete])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setState('processing')

      // Vibrate for haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50])
      }
    }
  }, [])

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    // Stop recording if in progress
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setState('idle')
    setDuration(0)
    setError(null)
    onCancel()
  }, [onCancel])

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Start recording immediately when component mounts
  useEffect(() => {
    startRecording()
  }, [startRecording])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />

      {/* Floating recorder */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-zinc-800 rounded-2xl shadow-2xl shadow-black/50 p-6 w-72">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                state === 'recording' ? 'bg-red-500 animate-pulse' :
                state === 'processing' ? 'bg-yellow-500' :
                'bg-zinc-500'
              }`} />
              <span className="text-sm font-medium text-zinc-300">
                {state === 'requesting-permission' && 'Requesting microphone...'}
                {state === 'recording' && 'Recording'}
                {state === 'processing' && 'Processing...'}
                {state === 'idle' && 'Ready'}
              </span>
            </div>
            <button
              onClick={handleCancel}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Duration display */}
          <div className="text-center mb-6">
            <div className="text-4xl font-mono font-bold text-zinc-100">
              {formatDuration(duration)}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {state === 'recording' ? 'Speak your expenses...' : ''}
            </p>
          </div>

          {/* Waveform visualization */}
          {state === 'recording' && (
            <div className="flex items-center justify-center gap-1 h-12 mb-4">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-pink-500 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 100}%`,
                    animationDelay: `${i * 50}ms`,
                    animationDuration: '0.5s',
                  }}
                />
              ))}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-3 bg-zinc-700 text-zinc-300 rounded-lg font-medium hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
            {(state === 'recording' || state === 'requesting-permission') && (
              <button
                onClick={stopRecording}
                className="flex-1 py-3 bg-pink-500 text-white rounded-lg font-medium shadow-lg shadow-pink-500/25 hover:bg-pink-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Stop
              </button>
            )}
            {state === 'processing' && (
              <div className="flex-1 py-3 bg-pink-500/50 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </div>
            )}
          </div>

          {/* Tip */}
          <p className="text-[10px] text-zinc-600 text-center mt-4">
            Try: "Lunch $15, taxi $20, salary $5000"
          </p>
        </div>
      </div>
    </>
  )
}
