import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // type scale (1.2 minor third), line-heights tuned for UI
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.65rem' }],
        xl: ['1.35rem', { lineHeight: '1.85rem' }],
        '2xl': ['1.62rem', { lineHeight: '2.1rem' }],
        '3xl': ['1.94rem', { lineHeight: '2.4rem' }],
        '4xl': ['2.33rem', { lineHeight: '2.75rem' }],
      },
      colors: {
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        surface: token('surface'),
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
          soft: token('primary-soft'),
        },
        secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        brass: { DEFAULT: token('brass'), soft: token('brass-soft') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        destructive: { DEFAULT: token('destructive'), foreground: token('destructive-foreground') },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        sidebar: {
          DEFAULT: token('sidebar'),
          foreground: token('sidebar-foreground'),
          muted: token('sidebar-muted'),
        },
        status: {
          success: token('status-success'),
          'success-soft': token('status-success-soft'),
          warning: token('status-warning'),
          'warning-soft': token('status-warning-soft'),
          danger: token('status-danger'),
          'danger-soft': token('status-danger-soft'),
          info: token('status-info'),
          'info-soft': token('status-info-soft'),
          neutral: token('status-neutral'),
          'neutral-soft': token('status-neutral-soft'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
      },
      boxShadow: {
        card: '0 1px 2px hsl(var(--shadow) / 0.06), 0 1px 3px hsl(var(--shadow) / 0.08)',
        raised: '0 4px 12px -2px hsl(var(--shadow) / 0.10), 0 2px 4px -2px hsl(var(--shadow) / 0.06)',
        overlay: '0 16px 40px -8px hsl(var(--shadow) / 0.22)',
      },
      spacing: { 4.5: '1.125rem', 13: '3.25rem', 18: '4.5rem' },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: { 'fade-in': 'fade-in 180ms ease-out' },
    },
  },
  plugins: [animate],
} satisfies Config
