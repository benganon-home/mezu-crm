import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'sans-serif'],
      },
      colors: {
        // MEZU Brand
        navy: {
          DEFAULT: '#30324D',
          light:   '#3D3F5C',
          dark:    '#252740',
          deeper:  '#1C1E30',
        },
        cream: {
          DEFAULT: '#F0EDE9',
          dark:    '#E8E4DE',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light:   '#E0C87A',
          dark:    '#9E8038',
        },
        muted: '#A8A9BF',
        // Status colors
        status: {
          received:   { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
          preparing:  { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
          ready:      { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
          shipped:    { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
          cancelled:  { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
        },
      },
      borderRadius: {
        DEFAULT: '8px',
      },
      fontSize: {
        xs:   ['11px', '1.5'],
        sm:   ['12px', '1.5'],
        base: ['13px', '1.6'],
        md:   ['14px', '1.6'],
        lg:   ['15px', '1.5'],
        xl:   ['17px', '1.4'],
        '2xl':['20px', '1.3'],
      },
    },
  },
  plugins: [],
}

export default config
