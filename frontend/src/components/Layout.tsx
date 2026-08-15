import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@tanstack/react-router'

/**
 * Portal targets for child pages to inject content into the Layout header.
 * - `headerPortal`: renders into the header button row (left of menu buttons)
 * - `belowHeaderPortal`: renders between the header and main content
 */
interface LayoutPortalContextValue {
  headerTarget: HTMLElement | null
  belowHeaderTarget: HTMLElement | null
}

const LayoutPortalContext = createContext<LayoutPortalContextValue>({
  headerTarget: null,
  belowHeaderTarget: null,
})

/** Hook for child pages to render portals into the Layout header area. */
export function useLayoutPortals() {
  return useContext(LayoutPortalContext)
}

/** Renders children into the Layout header button row. */
export function HeaderPortal({ children }: { children: ReactNode }) {
  const { headerTarget } = useLayoutPortals()
  if (!headerTarget) return null
  return createPortal(children, headerTarget)
}

/** Renders children between the header and main content. */
export function BelowHeaderPortal({ children }: { children: ReactNode }) {
  const { belowHeaderTarget } = useLayoutPortals()
  if (!belowHeaderTarget) return null
  return createPortal(children, belowHeaderTarget)
}

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const headerRef = useRef<HTMLDivElement>(null)
  const belowHeaderRef = useRef<HTMLDivElement>(null)
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null)
  const [belowHeaderTarget, setBelowHeaderTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (headerRef.current) setHeaderTarget(headerRef.current)
    if (belowHeaderRef.current) setBelowHeaderTarget(belowHeaderRef.current)
  }, [])

  return (
    <LayoutPortalContext.Provider value={{ headerTarget, belowHeaderTarget }}>
      <div className="flex min-h-dvh flex-col bg-zinc-950">
        <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-pink-500">
              Vibe My Life
            </h1>
            <div className="flex items-center gap-1">
            {/* Portal target: child pages inject header buttons here */}
            <div ref={headerRef} className="contents" />

            <button
              onClick={() => navigate({ to: '/apps' })}
              className="text-zinc-400 hover:text-zinc-100 transition-colors p-1"
              title="Apps"
              aria-label="Apps"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => navigate({ to: '/settings' })}
              className="text-zinc-400 hover:text-zinc-100 transition-colors p-1"
              title="Settings"
              aria-label="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            </div>
          </div>
        </header>

        {/* Portal target: child pages render search bars / sub-nav here */}
        <div ref={belowHeaderRef} />

        {/* Extra bottom padding clears the dashboard's fixed tab bar and FAB.
            The flex column lets a page fill exactly the space left below the header. */}
        <main className="flex flex-1 flex-col w-full max-w-lg mx-auto px-4 pt-6 pb-28">
          {children}
        </main>
      </div>
    </LayoutPortalContext.Provider>
  )
}
