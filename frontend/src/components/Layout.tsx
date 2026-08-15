import { useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface LayoutProps {
  children: React.ReactNode
  showSearch?: boolean
  onSearchToggle?: () => void
  searchContent?: ReactNode
}

export function Layout({ children, showSearch, onSearchToggle, searchContent }: LayoutProps) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950">
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-pink-500">
            Vibe My Life
          </h1>
          <div className="flex items-center gap-1">
          {onSearchToggle && (
            <button
              onClick={onSearchToggle}
              className={`transition-colors p-1 ${showSearch ? 'text-pink-500' : 'text-zinc-400 hover:text-zinc-100'}`}
              title="Search"
              aria-label="Search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}
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

      {/* Search bar slot — rendered between header and content */}
      {showSearch && searchContent}

      {/* Extra bottom padding clears the dashboard's fixed tab bar and FAB.
          The flex column lets a page fill exactly the space left below the header. */}
      <main className="flex flex-1 flex-col w-full max-w-lg mx-auto px-4 pt-6 pb-28">
        {children}
      </main>
    </div>
  )
}
