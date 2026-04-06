import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: he })
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'dd/MM', { locale: he })
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { locale: he, addSuffix: true })
}

export function formatPrice(price: number): string {
  const hasDecimals = price % 1 !== 0
  return `₪${price.toLocaleString('he-IL', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '').replace(/^972/, '0')
  if (clean.length === 10) return `${clean.slice(0,3)}-${clean.slice(3,6)}-${clean.slice(6)}`
  return phone
}

export function phoneToWa(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('0')) return `972${clean.slice(1)}`
  if (clean.startsWith('972')) return clean
  return clean
}

export function buildWaLink(phone: string, message: string): string {
  return `https://wa.me/${phoneToWa(phone)}?text=${encodeURIComponent(message)}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
