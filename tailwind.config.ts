import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        // Existing shadcn colors
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        
        // HR Platform Saudi Business Colors
        saudi: {
          navy: {
            50: '#f0f4f8',
            100: '#d9e2ec',
            200: '#bcccdc',
            300: '#9fb3c8',
            400: '#829ab1',
            500: '#627d98',
            600: '#486581',
            700: '#334e68',
            800: '#243b53',
            900: '#1a365d',
          },
          green: {
            50: '#f0fff4',
            100: '#c6f6d5',
            200: '#9ae6b4',
            300: '#68d391',
            400: '#48bb78',
            500: '#38a169',
            600: '#2f855a',
            700: '#276749',
            800: '#22543d',
            900: '#0f7b0f',
          },
          gold: {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d69e2e',
            700: '#b7791f',
            800: '#975a16',
            900: '#744210',
          },
        },
        
        // HR-specific status colors
        compliance: {
          excellent: '#10b981',
          good: '#22c55e',
          warning: '#f59e0b',
          poor: '#ef4444',
          pending: '#6b7280',
        },
        
        // Chat interface colors
        chat: {
          user: '#1a365d',
          assistant: '#f8fafc',
          'user-text': '#ffffff',
          'assistant-text': '#1e293b',
        },
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', ...fontFamily.sans],
        alt: ['var(--font-montserrat-alternates)'],
        // Arabic fonts
        arabic: ['Noto Sans Arabic', 'Cairo', 'Tajawal', ...fontFamily.sans],
        'arabic-display': ['Noto Kufi Arabic', 'Amiri', ...fontFamily.serif],
      },
      // RTL support spacing utilities
      spacing: {
        'rtl-2': '0.5rem',
        'rtl-4': '1rem',
        'rtl-6': '1.5rem',
        'rtl-8': '2rem',
      },
      
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'spin-slow': {
          '0%': { rotate: '0deg' },
          '100%': { rotate: '360deg' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'spin-slow': 'spin 10s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // RTL support plugin
    function ({ addUtilities }: any) {
      addUtilities({
        '.rtl-hidden': {
          '[dir="rtl"] &': {
            display: 'none',
          },
        },
        '.ltr-hidden': {
          '[dir="ltr"] &': {
            display: 'none',
          },
        },
        '.rtl-flex': {
          '[dir="rtl"] &': {
            display: 'flex',
          },
        },
        '.rtl-reverse': {
          '[dir="rtl"] &': {
            flexDirection: 'row-reverse',
          },
        },
        '.rtl-space-reverse': {
          '[dir="rtl"] & > :not([hidden]) ~ :not([hidden])': {
            '--tw-space-x-reverse': '1',
          },
        },
        '.text-start': {
          'text-align': 'start',
        },
        '.text-end': {
          'text-align': 'end',
        },
        // Arabic text improvements
        '.arabic-text': {
          fontFamily: 'Noto Sans Arabic, Cairo, Tajawal, sans-serif',
          lineHeight: '1.8',
          fontSize: '1rem',
        },
        '.arabic-heading': {
          fontFamily: 'Noto Kufi Arabic, Amiri, serif',
          fontWeight: '600',
          lineHeight: '1.4',
        },
      });
    },
  ],
};

export default config;
