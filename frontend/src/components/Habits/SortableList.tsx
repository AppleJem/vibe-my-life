import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

interface SortableListProps<T> {
  items: T[]
  keyOf: (item: T) => string
  /** Committed on release, and only when the order actually changed. */
  onReorder: (items: T[]) => void
  children: (item: T) => ReactNode
}

/**
 * Drag one row at a time to reorder, on `@dnd-kit`.
 *
 * The drag lives on a handle rather than the whole row, so the row itself is still free to be
 * a link. `TouchSensor` waits out a short press before claiming the gesture, which is what
 * keeps a flick over the handle scrolling the page instead of picking a row up.
 */
export function SortableList<T>({ items, keyOf, onReorder, children }: SortableListProps<T>) {
  const ids = items.map(keyOf)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return

    onReorder(arrayMove(items, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableRow key={keyOf(item)} id={keyOf(item)}>
              {children(item)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        position: 'relative',
        boxShadow: isDragging ? '0 10px 20px rgba(0,0,0,0.4)' : undefined,
        borderRadius: 12,
      }}
      className="flex items-center gap-2 h-16"
    >
      <div className="flex-1 min-w-0 h-full">{children}</div>

      {/* The only draggable surface. `touch-none` keeps the browser from claiming the
          gesture as a page scroll halfway through. */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="shrink-0 px-3 h-full text-zinc-500 hover:text-zinc-300 cursor-grab active:cursor-grabbing touch-none select-none"
      >
        ☰
      </button>
    </div>
  )
}
