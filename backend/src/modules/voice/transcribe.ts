/**
 * Speech to text, and nothing else.
 *
 * Split out of `voice.service.ts` because there are now two callers with different needs:
 * the expense flow, which transcribes and then runs the text through an expense-parsing
 * LLM pass, and the climbing app's description field, which wants the words as spoken and
 * no interpretation at all.
 */
import Groq, { toFile } from 'groq-sdk'
import { env } from '../../config/env.js'

// Lazily created so a missing API key surfaces as a clear runtime error, not an import crash
let groqClient: Groq | null = null
function getGroqClient(): Groq {
  if (!groqClient) {
    if (!env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured')
    }
    groqClient = new Groq({ apiKey: env.GROQ_API_KEY })
  }
  return groqClient
}

/**
 * Transcribe audio using Groq's Whisper model
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const groq = getGroqClient()

  console.log('Audio buffer size:', audioBuffer.length, 'bytes')
  console.log('MIME type:', mimeType)
  console.log('Magic bytes:', audioBuffer.subarray(0, 4).toString('hex'))

  // Dev-only escape hatch: dump the received audio so it can be inspected with ffprobe
  if (process.env.DEBUG_VOICE_DUMP) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(process.env.DEBUG_VOICE_DUMP, audioBuffer)
    console.log('Dumped audio to', process.env.DEBUG_VOICE_DUMP)
  }

  // Determine filename from MIME type
  const mimeToFilename: Record<string, string> = {
    'audio/webm': 'recording.webm',
    'audio/ogg': 'recording.ogg',
    'audio/mp4': 'recording.mp4',
    'audio/mpeg': 'recording.mp3',
    'audio/wav': 'recording.wav',
    'audio/mp3': 'recording.mp3',
    'audio/m4a': 'recording.m4a',
  }

  const cleanMimeType = mimeType.split(';')[0].trim()
  const filename = mimeToFilename[cleanMimeType] || 'recording.webm'

  console.log('Sending to Groq as:', filename, 'with MIME:', cleanMimeType)

  try {
    const file = await toFile(audioBuffer, filename, { type: cleanMimeType })
    const result = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      response_format: 'json',
    })
    console.log('[voice] Groq transcription result:', result)
    return result.text
  } catch (error: any) {
    console.error('Groq transcription error:', error)
    throw new Error(`Groq ASR failed: ${error.message}`)
  }
}
