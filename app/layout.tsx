import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/layout/Navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AOSN Dashboard',
  description: 'HubSpot Strategic Outreach & Pipeline Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col bg-[#fcfcfc]">
          {/* Header / Navigation */}
          <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic shadow-lg shadow-blue-200">A</div>
                  <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase italic">
                    AOSN Dashboard
                  </h1>
                </div>
                <Navigation />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 container mx-auto px-4 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t bg-gray-50 py-6">
            <div className="container mx-auto px-4 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                HubSpot Strategic Pipeline • Last Sync:{' '}
                <span className="text-gray-600">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
