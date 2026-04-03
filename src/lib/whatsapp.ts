import { Order, Customer } from '@/types'
import { buildWaLink } from './utils'

export type WaTemplate = 'order_ready' | 'order_shipped' | 'custom'

interface TemplateVars {
  customerName: string
  itemSummary?: string
  trackingNumber?: string
  invoiceUrl?: string
  customText?: string
}

export function buildTemplate(template: WaTemplate, vars: TemplateVars): string {
  switch (template) {
    case 'order_ready':
      return `שלום ${vars.customerName} 😊\nההזמנה שלך ממיזו מוכנה!${vars.itemSummary ? `\n${vars.itemSummary}` : ''}\nנשמח לתאם איתך משלוח / איסוף 🙏`
    case 'order_shipped':
      return `שלום ${vars.customerName} 😊\nההזמנה שלך ממיזו נשלחה! 📦${vars.trackingNumber ? `\nמספר מעקב: ${vars.trackingNumber}` : ''}${vars.invoiceUrl ? `\nחשבונית: ${vars.invoiceUrl}` : ''}`
    case 'custom':
      return vars.customText || ''
  }
}

export function getWaLink(customer: Customer, template: WaTemplate, vars?: Partial<TemplateVars>): string {
  const message = buildTemplate(template, { customerName: customer.name, ...vars })
  return buildWaLink(customer.phone, message)
}

export function getInvoiceWaLink(customer: Customer, invoiceUrl: string): string {
  const msg = `שלום ${customer.name}, מצורפת חשבונית עבור הזמנתך ממיזו 🧾\n${invoiceUrl}`
  return buildWaLink(customer.phone, msg)
}
