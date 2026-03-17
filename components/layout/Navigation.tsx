'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { label: 'Overview', href: '/' },
    { label: 'Activity', href: '/activity' },
    { label: 'Pipeline', href: '/pipeline' },
    // { label: 'Trends', href: '/trends' },
    { label: 'Game Plan', href: '/funnel' },
    { label: 'Map', href: '/map' },
  ]

  return (
    <nav className="flex gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
            pathname === item.href
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
