import { useSpring, animated, type AnimatedProps } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import type { HTMLAttributes } from 'react'

const AnimatedDiv = animated.div as React.ComponentType<AnimatedProps<HTMLAttributes<HTMLDivElement>>>

interface SwipeContainerProps {
  children: React.ReactNode
  onSwipeLeft: () => void
  onSwipeRight: () => void
}

export function SwipeContainer({ children, onSwipeLeft, onSwipeRight }: SwipeContainerProps) {
  const [{ x }, api] = useSpring(() => ({ x: 0 }))

  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx], direction: [dx] }) => {
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
    <AnimatedDiv
      {...bind()}
      style={{ x, touchAction: 'pan-y' } as any}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </AnimatedDiv>
  )
}
