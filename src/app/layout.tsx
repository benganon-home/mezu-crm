import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import '@/styles/globals.css'

const heebo = Heebo({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://mezu-crm.vercel.app'),
  title: 'MEZU CRM',
  description: 'מערכת ניהול הזמנות — MEZU',
  openGraph: {
    title: 'MEZU CRM',
    description: 'מערכת ניהול הזמנות — MEZU',
    siteName: 'MEZU',
    locale: 'he_IL',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body>{children}</body>
    </html>
  )
}
