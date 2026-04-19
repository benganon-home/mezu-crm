import AppLayout from '@/components/layout/AppLayout'

export const metadata = { title: 'קטגוריות — MEZU CRM' }

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
