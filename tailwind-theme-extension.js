// Tailwind CSS Theme Extension for HR Business Consultant RAG Platform
// This file extends the existing Tailwind configuration with Saudi business-appropriate
// colors, Arabic typography support, and HR platform-specific utilities.

const themeExtension = {
  // Custom colors for Saudi business environment
  colors: {
    // Saudi Business Professional Colors
    'saudi-navy': {
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
      950: '#0c1c2e',
      DEFAULT: '#1a365d',
      light: '#2c5282',
      dark: '#0c1c2e',
    },
    
    // Government Green (inspired by Saudi flag)
    'saudi-green': {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
      DEFAULT: '#0f7b0f',
      light: '#38a169',
      dark: '#065f46',
    },
    
    // Professional Gold (Saudi heritage)
    'saudi-gold': {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
      950: '#422006',
      DEFAULT: '#d69e2e',
      light: '#ecc94b',
      dark: '#b7791f',
    },
    
    // Compliance Status Colors
    'compliance': {
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      pending: '#6366f1',
      info: '#0ea5e9',
    },
    
    // Information Hierarchy
    'info': {
      primary: '#0ea5e9',
      secondary: '#64748b',
      subtle: '#94a3b8',
    },
    
    // Professional Grays (enhanced from default)
    'professional': {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    
    // Background System
    'bg': {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      elevated: '#ffffff',
    },
  },

  // Typography system with Arabic support
  fontFamily: {
    // Arabic fonts
    'arabic': ['Noto Sans Arabic', 'Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
    'arabic-display': ['Noto Kufi Arabic', 'Cairo', 'Amiri', 'serif'],
    
    // English fonts (existing)
    'sans': ['Inter', 'var(--font-montserrat)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
    'display': ['Inter', 'var(--font-montserrat-alternates)', 'system-ui', 'sans-serif'],
    
    // Bilingual system font stack
    'bilingual': ['Inter', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
  },

  // Enhanced font sizes for Arabic readability
  fontSize: {
    'xs': ['0.75rem', { lineHeight: '1rem' }],
    'sm': ['0.875rem', { lineHeight: '1.25rem' }],
    'base': ['1rem', { lineHeight: '1.5rem' }],
    'lg': ['1.125rem', { lineHeight: '1.75rem' }], // Minimum for Arabic body text
    'xl': ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
    '6xl': ['3.75rem', { lineHeight: '1' }],
    
    // Arabic-specific sizes
    'arabic-sm': ['0.875rem', { lineHeight: '1.375rem' }], // Extra line-height for Arabic
    'arabic-base': ['1rem', { lineHeight: '1.625rem' }],
    'arabic-lg': ['1.125rem', { lineHeight: '1.875rem' }],
    'arabic-xl': ['1.25rem', { lineHeight: '1.875rem' }],
  },

  // Enhanced spacing system
  spacing: {
    // Existing spacing preserved, adding HR platform-specific values
    '18': '4.5rem',   // 72px - Common for section spacing
    '22': '5.5rem',   // 88px - Large section spacing
    '26': '6.5rem',   // 104px - Extra large spacing
    '30': '7.5rem',   // 120px - Hero section spacing
    
    // Component-specific spacing
    'button-x': '1.5rem',  // 24px - Button horizontal padding
    'button-y': '0.75rem', // 12px - Button vertical padding
    'card': '1.5rem',      // 24px - Card padding
    'form-field': '1rem',  // 16px - Form field padding
  },

  // Border radius system
  borderRadius: {
    'none': '0',
    'sm': '0.125rem',     // 2px
    'DEFAULT': '0.25rem', // 4px
    'md': '0.375rem',     // 6px
    'lg': '0.5rem',       // 8px  - Standard for buttons/cards
    'xl': '0.75rem',      // 12px - Cards and containers
    '2xl': '1rem',        // 16px - Large cards
    '3xl': '1.5rem',      // 24px - Hero sections
    'full': '9999px',
    
    // Platform-specific radius
    'button': '0.5rem',   // 8px - Standard button radius
    'card': '0.75rem',    // 12px - Standard card radius
    'input': '0.5rem',    // 8px - Input field radius
    'badge': '1rem',      // 16px - Badge/pill radius
  },

  // Box shadows for depth hierarchy
  boxShadow: {
    // Existing shadows preserved, adding platform-specific
    'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    'button-hover': '0 4px 8px rgba(26, 54, 93, 0.3)',
    'focus': '0 0 0 3px rgba(26, 54, 93, 0.1)',
    
    // Saudi Navy themed shadows
    'saudi-navy-sm': '0 1px 2px 0 rgba(26, 54, 93, 0.05)',
    'saudi-navy': '0 4px 8px rgba(26, 54, 93, 0.15)',
    'saudi-navy-lg': '0 8px 16px rgba(26, 54, 93, 0.2)',
  },

  // Animation and transitions
  animation: {
    // Existing animations preserved
    'fadeIn': 'fadeIn 0.5s ease-in-out',
    'slideUp': 'slideUp 0.3s ease-out',
    'slideDown': 'slideDown 0.3s ease-out',
    'slideLeft': 'slideLeft 0.3s ease-out',
    'slideRight': 'slideRight 0.3s ease-out',
    'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    'loading': 'loading 1.5s infinite',
    'bounce-soft': 'bounce 1s infinite',
  },

  keyframes: {
    // Existing keyframes preserved, adding platform-specific
    fadeIn: {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' },
    },
    slideUp: {
      '0%': { transform: 'translateY(10px)', opacity: '0' },
      '100%': { transform: 'translateY(0)', opacity: '1' },
    },
    slideDown: {
      '0%': { transform: 'translateY(-10px)', opacity: '0' },
      '100%': { transform: 'translateY(0)', opacity: '1' },
    },
    slideLeft: {
      '0%': { transform: 'translateX(10px)', opacity: '0' },
      '100%': { transform: 'translateX(0)', opacity: '1' },
    },
    slideRight: {
      '0%': { transform: 'translateX(-10px)', opacity: '0' },
      '100%': { transform: 'translateX(0)', opacity: '1' },
    },
    loading: {
      '0%': { backgroundPosition: '200% 0' },
      '100%': { backgroundPosition: '-200% 0' },
    },
  },

  // Transition timing functions
  transitionTimingFunction: {
    'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    'ease-out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    'ease-in-out-back': 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
  },

  // Screen sizes for responsive design (Arabic content needs more space)
  screens: {
    'xs': '475px',
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
    'xl': '1280px',
    '2xl': '1536px',
    
    // Platform-specific breakpoints
    'tablet-md': '900px',  // Better for Arabic tablet layouts
    'desktop-sm': '1200px', // Better for Arabic desktop layouts
    'content-max': '1440px', // Maximum content width
  },

  // Z-index scale for layering
  zIndex: {
    '0': '0',
    '10': '10',
    '20': '20',
    '30': '30',
    '40': '40',
    '50': '50',
    'auto': 'auto',
    
    // Component-specific z-index
    'dropdown': '1000',
    'sticky': '1020',
    'fixed': '1030',
    'modal-backdrop': '1040',
    'modal': '1050',
    'popover': '1060',
    'tooltip': '1070',
    'toast': '1080',
  },

  // Container configuration for content width
  container: {
    center: true,
    padding: {
      DEFAULT: '1rem',  // 16px
      sm: '1.5rem',     // 24px
      lg: '2rem',       // 32px
      xl: '2rem',       // 32px
      '2xl': '2rem',    // 32px
    },
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px', // Maximum container width
    },
  },
};

// Utility classes for platform-specific needs
const platformUtilities = {
  // RTL utilities
  '.rtl-support': {
    '[dir="rtl"] &': {
      direction: 'rtl',
    },
  },
  
  // Arabic text utilities
  '.text-arabic': {
    fontFamily: 'var(--font-arabic)',
    lineHeight: '1.625',
    fontSize: '1.125rem', // Minimum readable size for Arabic
  },
  
  '.text-arabic-display': {
    fontFamily: 'var(--font-arabic-display)',
    fontWeight: '600',
  },
  
  // Bilingual text utilities
  '.text-bilingual': {
    fontFamily: 'var(--font-bilingual)',
    '&[dir="rtl"]': {
      fontFamily: 'var(--font-arabic)',
      lineHeight: '1.625',
    },
  },
  
  // Button variants for Saudi business context
  '.btn-saudi-primary': {
    backgroundColor: 'var(--saudi-navy)',
    color: 'white',
    '&:hover': {
      backgroundColor: 'var(--saudi-navy-light)',
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 8px rgba(26, 54, 93, 0.3)',
    },
  },
  
  '.btn-saudi-secondary': {
    backgroundColor: 'transparent',
    color: 'var(--saudi-navy)',
    borderWidth: '2px',
    borderColor: 'var(--saudi-navy)',
    '&:hover': {
      backgroundColor: 'var(--saudi-navy)',
      color: 'white',
    },
  },
  
  // Compliance status utilities
  '.status-compliant': {
    backgroundColor: 'var(--compliance-success)',
    color: 'white',
  },
  
  '.status-warning': {
    backgroundColor: 'var(--compliance-warning)',
    color: 'white',
  },
  
  '.status-error': {
    backgroundColor: 'var(--compliance-error)',
    color: 'white',
  },
  
  '.status-pending': {
    backgroundColor: 'var(--compliance-pending)',
    color: 'white',
  },
  
  // Card variants
  '.card-elevated': {
    backgroundColor: 'white',
    borderWidth: '1px',
    borderColor: 'var(--professional-200)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  
  // Loading state utilities
  '.skeleton': {
    background: 'linear-gradient(90deg, var(--professional-200) 25%, var(--professional-100) 50%, var(--professional-200) 75%)',
    backgroundSize: '200% 100%',
    animation: 'loading 1.5s infinite',
  },
  
  // Focus utilities for accessibility
  '.focus-saudi': {
    '&:focus-visible': {
      outline: '2px solid var(--saudi-navy)',
      outlineOffset: '2px',
    },
  },
  
  // Responsive Arabic text
  '.responsive-arabic': {
    fontSize: '1rem',
    lineHeight: '1.5',
    '@screen sm': {
      fontSize: '1.125rem',
      lineHeight: '1.625',
    },
    '@screen md': {
      fontSize: '1.125rem',
      lineHeight: '1.75',
    },
  },
};

module.exports = {
  themeExtension,
  platformUtilities,
};

// Usage Example:
// In your tailwind.config.ts, import and use like this:
// 
// const { themeExtension, platformUtilities } = require('./tailwind-theme-extension.js');
// 
// module.exports = {
//   theme: {
//     extend: themeExtension,
//   },
//   plugins: [
//     plugin(function({ addUtilities }) {
//       addUtilities(platformUtilities);
//     }),
//   ],
// };