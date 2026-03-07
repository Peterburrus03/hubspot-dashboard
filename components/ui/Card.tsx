import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddings = { none: 'p-0', sm: 'p-4', md: 'p-6', lg: 'p-8' }
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${paddings[padding]} ${className}`}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  sublabel?: string
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'gray' | 'rose'
}

const colorMap = {
  blue: 'text-blue-600 bg-blue-50',
  green: 'text-green-600 bg-green-50',
  purple: 'text-purple-600 bg-purple-50',
  orange: 'text-orange-600 bg-orange-50',
  gray: 'text-gray-600 bg-gray-50',
  rose: 'text-rose-600 bg-rose-50',
}

export function StatCard({ label, value, sublabel, color = 'blue' }: StatCardProps) {
  return (
    <div className={`rounded-lg border border-gray-200 p-5 ${colorMap[color].split(' ')[1]}`}>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colorMap[color].split(' ')[0]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
    </div>
  )
}
