import { useCategories } from '../../../contexts/MetadataContext'
import { parseCategory, formatCategory, type Category } from '../../../constants/categories'

interface CategoryPickerProps {
  value: string
  onChange: (category: string) => void
}

const COLUMNS = 4

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size))
  }
  return rows
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const { categories } = useCategories()
  const { parent: selectedParent, sub: selectedSub } = parseCategory(value)

  const expanded = categories.find(
    (c) => c.name === selectedParent && c.subcategories.length > 0
  )

  const renderParent = (cat: Category) => {
    const isSelected = cat.name === selectedParent

    return (
      <button
        key={cat.name}
        onClick={() => onChange(cat.name)}
        className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all ${
          isSelected
            ? 'bg-rose-400/20 ring-2 ring-rose-400 shadow-lg shadow-rose-400/10'
            : 'bg-zinc-800 hover:bg-zinc-700'
        }`}
      >
        <span
          className={`text-[11px] font-medium text-center leading-tight ${
            isSelected ? 'text-rose-400' : 'text-zinc-400'
          }`}
        >
          {cat.name}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {chunk(categories, COLUMNS).map((row, rowIndex) => {
        const showSubcategories = !!expanded && row.some((c) => c.name === expanded.name)

        return (
          <div key={rowIndex} className="space-y-2">
            <div className="grid grid-cols-4 gap-2">{row.map(renderParent)}</div>

            {showSubcategories && (
              <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-zinc-800/50">
                <button
                  onClick={() => onChange(expanded.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    !selectedSub
                      ? 'bg-rose-400/20 ring-1 ring-rose-400 text-rose-400'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  None
                </button>
                {expanded.subcategories.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => onChange(formatCategory(expanded.name, sub))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedSub === sub
                        ? 'bg-rose-400/20 ring-1 ring-rose-400 text-rose-400'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
