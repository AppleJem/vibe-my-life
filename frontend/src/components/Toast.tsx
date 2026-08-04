interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

export function Toast({ message, type, onClose }: ToastProps) {
  const bgColor = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-cyan-500',
  }[type]

  return (
    <div
      className={`${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 hover:opacity-80">
        ✕
      </button>
    </div>
  )
}
