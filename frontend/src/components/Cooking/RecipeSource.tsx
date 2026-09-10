import { useRef, useState } from 'react'
import { INPUT } from './fieldStyles'

interface RecipeSourceProps {
  isParsing: boolean
  error: string | null
  onParse: (source: { text?: string; images: File[] }) => void
  /** Skips the parser entirely — a blank form, for a recipe out of your own head. */
  onWriteByHand: () => void
}

/** What the parsing model accepts in one request — see `recipe.parser.ts`. */
const MAX_IMAGES = 3

/**
 * Where a recipe comes in: photographed, pasted, or both at once.
 *
 * Both go to the same endpoint and the same model in a single pass — a photo is not OCR'd
 * into text and parsed again, because the layout is half the information. A column of amounts
 * down the left of a page *is* the ingredient list, and flattening it to a string first
 * throws that away.
 *
 * Nothing here saves. What comes back is a draft on a review screen, so a page the parser
 * read badly costs a glance rather than a recipe to clean up afterwards.
 */
export function RecipeSource({ isParsing, error, onParse, onWriteByHand }: RecipeSourceProps) {
  const [text, setText] = useState('')
  const [images, setImages] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canParse = (text.trim().length > 0 || images.length > 0) && !isParsing

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    if (picked.length > 0) {
      setImages((current) => [...current, ...picked].slice(0, MAX_IMAGES))
    }
    // Reset, so picking the same file twice in a row still fires a change.
    event.target.value = ''
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={images.length >= MAX_IMAGES}
        className="w-full rounded-2xl bg-zinc-900 border border-dashed border-zinc-700 py-8 text-center hover:bg-zinc-800 transition-colors disabled:opacity-40"
      >
        <span className="block text-3xl">📷</span>
        <span className="mt-2 block text-sm font-medium text-zinc-200">
          {images.length === 0 ? 'Photograph a recipe' : 'Add another photo'}
        </span>
        <span className="mt-1 block text-xs text-zinc-500">
          A cookbook page, a screenshot, a card — up to {MAX_IMAGES}
        </span>
      </button>

      {images.length > 0 && (
        <ul className="mt-3 space-y-2">
          {images.map((image, index) => (
            <li
              key={`${image.name}-${index}`}
              className="flex items-center gap-3 rounded-xl bg-zinc-900 px-3 py-2"
            >
              <span className="text-lg">🖼️</span>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{image.name}</span>
              <button
                onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                aria-label={`Remove ${image.name}`}
                className="shrink-0 px-2 text-zinc-600 hover:text-red-400 transition-colors"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-zinc-800" />
        <span className="text-xs text-zinc-600">and / or</span>
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the recipe here — ingredients, method, however it was written."
        rows={8}
        className={`${INPUT} resize-none`}
      />

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        onClick={() => onParse({ text: text.trim() || undefined, images })}
        disabled={!canParse}
        className="mt-5 w-full rounded-xl bg-amber-400 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40"
      >
        {isParsing ? 'Reading…' : 'Read the recipe'}
      </button>

      <button
        onClick={onWriteByHand}
        className="mt-4 w-full py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        Or write one by hand
      </button>
    </div>
  )
}
