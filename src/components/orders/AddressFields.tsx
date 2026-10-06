'use client'

import { AddressParts, ADDRESS_LIMITS, ADDRESS_LABELS } from '@/lib/address'

export const EMPTY_ADDRESS: AddressParts = { city: '', street: '', building: '', entrance: '', floor: '', apartment: '' }

const REQUIRED: (keyof AddressParts)[] = ['city', 'street', 'building']

// City + street on their own rows, then building / entrance / floor / apartment.
export function AddressFields({ value, onChange, autoFocus }: {
  value: AddressParts
  onChange: (v: AddressParts) => void
  autoFocus?: boolean
}) {
  const field = (k: keyof AddressParts, focus?: boolean) => (
    <input
      key={k}
      className="input text-sm"
      placeholder={ADDRESS_LABELS[k] + (REQUIRED.includes(k) ? ' *' : '')}
      aria-label={ADDRESS_LABELS[k]}
      value={value[k] ?? ''}
      maxLength={ADDRESS_LIMITS[k]}
      onChange={e => onChange({ ...value, [k]: e.target.value })}
      autoFocus={focus}
    />
  )
  return (
    <div className="flex flex-col gap-2">
      {field('city', autoFocus)}
      {field('street')}
      <div className="grid grid-cols-4 gap-2">
        {field('building')}
        {field('entrance')}
        {field('floor')}
        {field('apartment')}
      </div>
    </div>
  )
}
