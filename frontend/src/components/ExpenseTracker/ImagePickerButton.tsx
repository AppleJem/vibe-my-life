import { useState, useRef, useCallback } from 'react'

interface ImagePickerButtonProps {
  onImagesSelected: (files: File[]) => void
  onStandardClick: () => void
}

export function ImagePickerButton({ onImagesSelected, onStandardClick }: ImagePickerButtonProps) {
  const [showImageOption, setShowImageOption] = useState(false)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const isLongPress = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePointerDown = useCallback(() => {
    isLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true
      setShowImageOption(true)
      // Optional: Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 500) // 500ms threshold for long press
  }, [])

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    
    if (!isLongPress.current) {
      // Short tap - standard add expense
      onStandardClick()
    }
  }, [onStandardClick])

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleImageOptionClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        onImagesSelected(files)
      }
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setShowImageOption(false)
    },
    [onImagesSelected]
  )

  const handleBackdropClick = useCallback(() => {
    setShowImageOption(false)
  }, [])

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Image option popup */}
      {showImageOption && (
        <>
          {/* Backdrop to close the popup */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleBackdropClick}
          />
          
          {/* Image picker button */}
          <button
            onClick={handleImageOptionClick}
            className="fixed bottom-44 right-6 w-14 h-14 bg-violet-500 rounded-full shadow-lg shadow-violet-500/25 flex items-center justify-center hover:shadow-violet-500/40 transition-all z-50 animate-in fade-in slide-in-from-bottom-2"
            title="Parse expenses from screenshot"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
        </>
      )}

      {/* Main FAB - Add expense */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed bottom-24 right-6 w-14 h-14 bg-pink-500 rounded-full shadow-lg shadow-pink-500/25 flex items-center justify-center hover:shadow-pink-500/40 transition-shadow z-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </>
  )
}
