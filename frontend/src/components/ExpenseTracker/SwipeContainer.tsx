import { useSpring, animated } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'

interface SwipeContainerProps {
  children: React.ReactNode
  onSwipeLeft: () => void
  onSwipeRight: () => void
}

export function SwipeContainer({ children, onSwipeLeft, onSwipeRight }: SwipeContainerProps) {
  const [{ x }, api] = useSpring(() => ({ x: 0 }))

  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
      if (!down) {
        // Trigger swipe if velocity or distance exceeds threshold
        if (Math.abs(mx) > 100 || (Math.abs(vx) > 0.5 && Math.abs(mx) > 30)) {
          if (mx < 0 || (vx > 0.5 && dx < 0)) {
            onSwipeLeft()
          } else if (mx > 0 || (vx > 0.5 && dx > 0)) {
            onSwipeRight()
          }
        }
        api.start({ x: 0 })
        return
      }
      
      // Limit drag distance
      const clampedX = Math.max(-150, Math.min(150, mx))
      api.start({ x: clampedX, immediate: true })
    },
    { axis: 'x', filterTaps: true }
  )

  return (
    <animated.div
      {...bind()}
      style={{ x, touchAction: 'pan-y' }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </animated.div>
  )
}
