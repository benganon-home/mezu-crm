'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingBag, Users, Bell, BarChart2, Settings, Package,
  Menu, X, ChevronsLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/orders',    icon: ShoppingBag, label: 'הזמנות'   },
  { href: '/customers', icon: Users,       label: 'לקוחות'   },
  { href: '/products',  icon: Package,     label: 'מוצרים'   },
  { href: '/reminders', icon: Bell,        label: 'תזכורות'  },
  { href: '/analytics', icon: BarChart2,   label: 'אנליטיקס' },
  { href: '/settings',  icon: Settings,    label: 'הגדרות'   },
] as const

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [dark, setDark] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Sync dark mode from localStorage on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mezu_dark') === 'true'
      setDark(saved)
      if (saved) document.documentElement.classList.add('dark')
    }
  })

  return (
    <div
      className={cn('flex h-screen overflow-hidden', dark && 'dark')}
      style={{ ['--app-sidebar-width' as string]: collapsed ? '64px' : '220px' }}
    >

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
        'transition-all duration-250',
        'md:translate-x-0 md:static md:z-auto',
        collapsed ? 'w-[64px]' : 'w-[220px]',
        mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
      )}
      style={{ background: 'linear-gradient(180deg, #ECEAFF 0%, #E8E5FF 100%)' }}
      >

        {/* Logo */}
        <div className={cn('flex items-center justify-between py-5 border-b border-[#D8D4F5]', collapsed ? 'px-3' : 'px-5')}>
          {!collapsed && (
            <img
              src="/logo svg.svg"
              alt="MEZU"
              className="h-6 w-auto dark:brightness-0 dark:invert"
              style={{ maxWidth: 90 }}
            />
          )}
          {collapsed && <div className="w-full" />}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-muted hover:text-navy dark:hover:text-cream"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center gap-3 py-2.5 rounded-xl text-sm transition-all duration-150',
                  collapsed ? 'justify-center px-0' : 'px-3',
                  active
                    ? 'bg-gold text-white font-medium shadow-md shadow-gold/30'
                    : 'text-[#9490B8] hover:text-navy hover:bg-white/60'
                )}
              >
                <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 py-4 border-t border-[#D8D4F5]">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden md:flex items-center justify-center w-full p-2.5 rounded-xl text-[#9490B8] hover:text-navy hover:bg-white/60 transition-all"
            title={collapsed ? 'הרחב' : 'כווץ'}
            dir="ltr"
          >
            <ChevronsLeft size={16} className={cn('transition-transform duration-250', collapsed && 'rotate-180')} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0 transition-all duration-250">

        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-navy-deeper border-b border-cream-dark dark:border-navy-light backdrop-blur-sm">
          <img src="/logo svg.svg" alt="MEZU" className="h-5 w-auto dark:brightness-0 dark:invert" />
          <button onClick={() => setMobileOpen(true)} className="text-navy dark:text-cream">
            <Menu size={20} />
          </button>
        </div>

        <div className="p-5 md:p-7 w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
