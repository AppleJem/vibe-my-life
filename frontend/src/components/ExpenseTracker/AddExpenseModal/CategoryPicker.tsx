import { CATEGORIES } from '../../../constants/categories'

interface CategoryPickerProps {
  value: string
  onChange: (category: string) => void
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {CATEGORIES.map((cat) => {
        const isSelected = cat.key === value

        return (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
              isSelected
                ? 'bg-rose-400/20 ring-2 ring-rose-400 shadow-lg shadow-rose-400/10'
                : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <span className="text-3xl">{cat.emoji}</span>
            <span className={`text-xs font-medium ${isSelected ? 'text-rose-400' : 'text-zinc-400'}`}>
              {cat.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
