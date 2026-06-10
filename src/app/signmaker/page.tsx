'use client'
import SignEditor from '@/components/signmaker/SignEditor'

export default function SignmakerPage() {
  return (
    <div dir="rtl" className="space-y-4">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-navy dark:text-cream">יצירת שלטים</h1>
      </div>
      <div className="surface p-5">
        <SignEditor />
      </div>
    </div>
  )
}
