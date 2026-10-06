// Structured shipping address. The parts are stored in their own DB columns
// (orders.delivery_*, customers.address_*) and feed the courier label; the
// formatted string stays in delivery_address / address for display, search,
// emails and export. Shared with mezu-store (src/lib/address.ts) — keep in sync.

export interface AddressParts {
  city:      string
  street:    string
  building:  string
  entrance?: string
  floor?:    string
  apartment?: string
}

// Courier (Run / K-Express) field limits.
export const ADDRESS_LIMITS = {
  city: 30, street: 30, building: 5, entrance: 2, floor: 2, apartment: 4,
} as const

export const ADDRESS_LABELS: Record<keyof AddressParts, string> = {
  city: 'עיר', street: 'רחוב', building: 'מספר בית', entrance: 'כניסה', floor: 'קומה', apartment: 'דירה',
}

const clean =(v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

export function normalizeAddress(raw: Partial<Record<keyof AddressParts, unknown>> | null | undefined): AddressParts {
  return {
    city:      clean(raw?.city),
    street:    clean(raw?.street),
    building:  clean(raw?.building),
    entrance:  clean(raw?.entrance),
    floor:     clean(raw?.floor),
    apartment: clean(raw?.apartment),
  }
}

// Returns a Hebrew error message, or null when the address is usable.
export function validateAddress(a: AddressParts): string | null {
  if (!a.city)     return 'יש למלא עיר'
  if (!a.street)   return 'יש למלא רחוב'
  if (!a.building) return 'יש למלא מספר בית'
  for (const [k, max] of Object.entries(ADDRESS_LIMITS) as [keyof AddressParts, number][]) {
    if ((a[k] ?? '').length > max) return `${ADDRESS_LABELS[k]}: עד ${max} תווים`
  }
  return null
}

// "הרצל 15 כניסה ב קומה 2 דירה 5, תל אביב" — the order matches the CRM's
// legacy parser so old and new addresses read the same.
export function formatAddress(a: AddressParts): string {
  let line = `${a.street} ${a.building}`.trim()
  if (a.entrance)  line += ` כניסה ${a.entrance}`
  if (a.floor)     line += ` קומה ${a.floor}`
  if (a.apartment) line += ` דירה ${a.apartment}`
  return a.city ? `${line}, ${a.city}` : line
}

// DB column maps.
export const orderAddressColumns = (a: AddressParts) => ({
  delivery_city:      a.city || null,
  delivery_street:    a.street || null,
  delivery_building:  a.building || null,
  delivery_entrance:  a.entrance || null,
  delivery_floor:     a.floor || null,
  delivery_apartment: a.apartment || null,
})

export const customerAddressColumns = (a: AddressParts) => ({
  address_city:      a.city || null,
  address_street:    a.street || null,
  address_building:  a.building || null,
  address_entrance:  a.entrance || null,
  address_floor:     a.floor || null,
  address_apartment: a.apartment || null,
})
