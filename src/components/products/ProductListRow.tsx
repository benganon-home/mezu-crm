'use client'

import { ImageIcon, Edit2, Copy } from 'lucide-react'
import { Product } from '@/types'
import { formatPrice, cn } from '@/lib/utils'

interface Props {
  product: Product
  onEdit: () => void
  onDuplicate: () => void
}

export function ProductListRow({ product, onEdit, onDuplicate }: Props) {
  const mainImage = product.images?.[0]

  return (
    <div className={cn(
      'flex items-center gap-4 px-4 py-3 border-b border-cream-dark dark:border-navy-light/40 last:border-b-0',
      'hover:bg-gold/5 dark:hover:bg-white/3 transition-colors',
      !product.is_active && 'opacity-50'
    )}>

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-cream dark:bg-navy-deeper flex items-center justify-center shrink-0">
        {mainImage
          ? <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
          : <ImageIcon size={18} className="text-muted/30" strokeWidth={1} />
        }
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{product.name}</span>
          {!product.is_active && (
            <span className="text-[10px] bg-navy/10 dark:bg-white/10 text-muted px-1.5 py-0.5 rounded-full shrink-0">לא פעיל</span>
          )}
        </div>
        {product.description && (
          <div className="text-xs text-muted truncate mt-0.5">{product.description}</div>
        )}
      </div>

      {/* Category */}
      <div className="w-[90px] shrink-0">
        {product.category
          ? <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full">{product.category}</span>
          : <span className="text-xs text-muted/40">—</span>
        }
      </div>

      {/* Sizes */}
      <div className="w-[180px] shrink-0 flex flex-col gap-0.5">
        {product.sizes?.length > 0 ? (
          product.sizes.slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted">{s.label}</span>
              <span className="font-medium ltr">{formatPrice(s.price)}</span>
            </div>
          ))
        ) : (
          <span className="text-xs font-medium ltr">{formatPrice(product.base_price)}</span>
        )}
        {product.sizes?.length > 3 && (
          <span className="text-[10px] text-muted">+{product.sizes.length - 3} נוספות</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDuplicate}
          className="p-2 text-muted hover:text-gold rounded-lg hover:bg-gold/10 transition-colors"
          title="שכפל"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={onEdit}
          className="p-2 text-muted hover:text-navy dark:hover:text-cream rounded-lg hover:bg-cream-dark dark:hover:bg-navy-light transition-colors"
          title="עריכה"
        >
          <Edit2 size={14} />
        </button>
      </div>
    </div>
  )
}
