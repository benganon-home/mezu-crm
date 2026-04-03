import type { Metadata } from 'next'
import { Assistant } from 'next/font/google'
import '@/styles/globals.css'

const assistant = Assistant({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MEZU CRM',
  description: 'מערכת ניהול הזמנות — MEZU',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={assistant.className}>
      <body>{children}</body>
    </html>
  )
}
