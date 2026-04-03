'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingBag, Users, Bell, BarChart2, Settings,
  Menu, X, Moon, Sun, Package
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/orders',    icon: ShoppingBag, label: 'הזמנות'   },
  { href: '/customers', icon: Users,       label: 'לקוחות'   },
  { href: '/reminders', icon: Bell,        label: 'תזכורות'  },
  { href: '/analytics', icon: BarChart2,   label: 'אנליטיקס' },
  { href: '/settings',  icon: Settings,    label: 'הגדרות'   },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [dark, setDark] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleDark = () => {
    setDark(d => !d)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className={cn('flex h-screen overflow-hidden', dark && 'dark')}>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — right side (RTL) */}
      <aside className={cn(
        'fixed top-0 right-0 h-full z-50 flex flex-col',
        'w-[220px] bg-navy text-cream',
        'border-l border-navy-light',
        'transition-transform duration-250',
        'md:translate-x-0 md:static md:z-auto',
        mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
      )}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-navy-light">
          <div className="flex items-center gap-2.5">
            <Package size={18} className="text-gold" />
            <span className="text-lg font-semibold tracking-[0.12em] text-cream">
              MEZU
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-muted hover:text-cream"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-100',
                  active
                    ? 'bg-gold/15 text-gold font-medium'
                    : 'text-cream/55 hover:text-cream hover:bg-white/7'
                )}
              >
                <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-navy-light flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-cream/50 hover:text-cream hover:bg-white/7 transition-colors w-full"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            <span>{dark ? 'מצב יום' : 'מצב לילה'}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-cream dark:bg-navy-deeper min-w-0">

        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-navy text-cream">
          <span className="font-semibold tracking-wide">MEZU</span>
          <button onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
        </div>

        <div className="p-5 md:p-7 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  )
}
