'use client'

import { ImageIcon, Edit2 } from 'lucide-react'
import { Product } from '@/types'
import { formatPrice, cn } from '@/lib/utils'

interface Props {
  product: Product
  onClick: () => void
}

export function ProductCard({ product, onClick }: Props) {
  const mainImage = product.images?.[0]

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative bg-white dark:bg-navy-dark rounded-2xl border border-cream-dark dark:border-navy-light overflow-hidden cursor-pointer',
        'hover:shadow-lg hover:border-gold/40 transition-all duration-200',
        !product.is_active && 'opacity-50'
      )}
    >
      {/* Image */}
      <div className="aspect-square bg-cream dark:bg-navy-deeper relative overflow-hidden">
        {mainImage ? (
          <img
            src={mainImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={32} className="text-muted/20" strokeWidth={1} />
          </div>
        )}

        {/* Edit overlay */}
        <div className="absolute inset-0 bg-navy/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg">
            <Edit2 size={14} className="text-navy" />
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {!product.is_active && (
            <span className="text-[10px] bg-navy/70 text-cream px-2 py-0.5 rounded-full">לא פעיל</span>
          )}
          {product.category && (
            <span className="text-[10px] bg-gold/90 text-white px-2 py-0.5 rounded-full">{product.category}</span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="font-medium text-sm truncate">{product.name}</div>

        {product.description && (
          <div className="text-xs text-muted mt-0.5 line-clamp-2 leading-relaxed">{product.description}</div>
        )}

        <div className="mt-2">
          <div className="flex flex-col gap-1">
            {product.sizes.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted">{s.label}</span>
                <span className="font-semibold text-gold ltr">{formatPrice(s.price)}</span>
              </div>
            ))}
            {product.sizes.length > 3 && (
              <span className="text-[10px] text-muted">+{product.sizes.length - 3} מידות נוספות</span>
            )}
            {product.sizes.length === 0 && (
              <span className="text-xs text-muted/50">אין מידות</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
