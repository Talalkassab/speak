# HR Platform Design System Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing the HR Business Consultant RAG platform design system. It builds upon the existing Next.js + Tailwind CSS + shadcn/ui foundation to create a professional, bilingual platform for Saudi Arabian businesses.

## Quick Start Checklist

### ✅ Phase 1: Foundation Setup
- [ ] Update Tailwind configuration with Saudi business theme
- [ ] Add Arabic font imports to layout
- [ ] Create CSS custom properties for design tokens
- [ ] Set up RTL directive handling
- [ ] Test basic bilingual layout switching

### ✅ Phase 2: Core Components
- [ ] Extend existing shadcn/ui components with Saudi business styling
- [ ] Create platform-specific components (chat, upload, compliance)
- [ ] Implement RTL-aware layout components
- [ ] Add Arabic typography utilities
- [ ] Create status and badge components

### ✅ Phase 3: Platform Features
- [ ] Build chat interface with Arabic support
- [ ] Implement document upload with Arabic file handling
- [ ] Create compliance tracking components
- [ ] Add source attribution system
- [ ] Build dashboard widgets

## Implementation Steps

### Step 1: Update Tailwind Configuration

Replace your current `tailwind.config.ts` with the enhanced version:

```typescript
import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';

const { themeExtension, platformUtilities } = require('./tailwind-theme-extension.js');

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
      // Existing shadcn/ui colors preserved
      colors: {
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
        // Add Saudi business colors
        ...themeExtension.colors,
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: 'calc(var(--radius) - 4px)',
        ...themeExtension.borderRadius,
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', ...fontFamily.sans],
        alt: ['var(--font-montserrat-alternates)'],
        ...themeExtension.fontFamily,
      },
      // Add all other theme extensions
      ...themeExtension,
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    plugin(function({ addUtilities, addDirectives }) {
      addUtilities(platformUtilities);
      // Add RTL support
      addDirectives({
        '@tailwind rtl': {},
      });
    }),
  ],
};

export default config;
```

### Step 2: Update CSS Custom Properties

Update `src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Existing shadcn/ui variables preserved */
    --background: 240 6% 10%;
    --foreground: 60 0% 90%;
    --muted: 240 6% 10%;
    --muted-foreground: 240 5% 84%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 47.4% 11.2%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 47.4% 11.2%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 100% 50%;
    --destructive-foreground: 210 40% 98%;
    --ring: 215 20.2% 65.1%;
    --radius: 0.5rem;

    /* Saudi Business Color Tokens */
    --saudi-navy: #1a365d;
    --saudi-navy-light: #2c5282;
    --saudi-navy-dark: #0c1c2e;
    --saudi-green: #0f7b0f;
    --saudi-green-light: #38a169;
    --saudi-green-dark: #065f46;
    --saudi-gold: #d69e2e;
    --saudi-gold-light: #ecc94b;
    --saudi-gold-dark: #b7791f;
    
    /* Compliance Colors */
    --compliance-success: #22c55e;
    --compliance-warning: #f59e0b;
    --compliance-error: #ef4444;
    --compliance-pending: #6366f1;
    
    /* Professional Grays */
    --professional-50: #f8fafc;
    --professional-100: #f1f5f9;
    --professional-200: #e2e8f0;
    --professional-300: #cbd5e1;
    --professional-400: #94a3b8;
    --professional-500: #64748b;
    --professional-600: #475569;
    --professional-700: #334155;
    --professional-800: #1e293b;
    --professional-900: #0f172a;
    
    /* Background System */
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-tertiary: #f1f5f9;
    --bg-elevated: #ffffff;

    /* Font Variables */
    --font-arabic: 'Noto Sans Arabic', 'Cairo', 'Tajawal', system-ui, sans-serif;
    --font-arabic-display: 'Noto Kufi Arabic', 'Cairo', 'Amiri', serif;
    --font-bilingual: 'Inter', 'Noto Sans Arabic', system-ui, sans-serif;
  }

  /* Dark mode (if needed) */
  .dark {
    --background: 224 71% 4%;
    --foreground: 213 31% 91%;
    /* ... keep existing dark mode variables ... */
  }

  /* Global styles enhanced for bilingual support */
  ::selection {
    @apply text-black bg-saudi-gold-light;
  }

  *:focus-visible {
    @apply outline outline-2 outline-offset-2 outline-saudi-navy;
  }

  * {
    @apply border-border min-w-0;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }

  html, body {
    @apply h-full;
  }

  /* Enhanced typography for bilingual content */
  h1 {
    @apply font-alt font-bold text-4xl text-white lg:text-6xl;
    @apply bg-clip-text drop-shadow-[0_0_15px_rgba(0,0,0,1)];
    @apply lg:text-transparent lg:bg-gradient-to-br from-white to-neutral-400;
  }

  /* Arabic text enhancements */
  [dir="rtl"] {
    font-family: var(--font-arabic);
  }

  [dir="rtl"] h1, [dir="rtl"] h2, [dir="rtl"] h3 {
    font-family: var(--font-arabic-display);
    line-height: 1.4;
  }

  [dir="rtl"] p, [dir="rtl"] span, [dir="rtl"] div {
    line-height: 1.625;
  }

  /* Professional button styles */
  .btn-saudi-primary {
    @apply bg-saudi-navy text-white hover:bg-saudi-navy-light;
    @apply transition-all duration-200 hover:transform hover:-translate-y-0.5;
    @apply hover:shadow-lg;
  }

  .btn-saudi-secondary {
    @apply border-2 border-saudi-navy text-saudi-navy bg-transparent;
    @apply hover:bg-saudi-navy hover:text-white transition-all duration-200;
  }

  /* Compliance status styles */
  .status-compliant {
    @apply bg-compliance-success text-white;
  }

  .status-warning {
    @apply bg-compliance-warning text-white;
  }

  .status-error {
    @apply bg-compliance-error text-white;
  }

  .status-pending {
    @apply bg-compliance-pending text-white;
  }
}

/* RTL-specific utilities */
@layer utilities {
  .text-start {
    text-align: start;
  }
  
  .text-end {
    text-align: end;
  }
  
  [dir="ltr"] .ltr\:text-left {
    text-align: left;
  }
  
  [dir="rtl"] .rtl\:text-right {
    text-align: right;
  }

  /* Arabic typography utilities */
  .arabic-text {
    font-family: var(--font-arabic);
    font-size: 1.125rem;
    line-height: 1.625;
    font-weight: 500;
  }

  .arabic-display {
    font-family: var(--font-arabic-display);
    font-weight: 600;
    line-height: 1.4;
  }

  .bilingual-text {
    font-family: var(--font-bilingual);
  }

  [dir="rtl"] .bilingual-text {
    font-family: var(--font-arabic);
    line-height: 1.625;
  }
}
```

### Step 3: Update Layout for Bilingual Support

Update `src/app/layout.tsx`:

```typescript
import { PropsWithChildren } from 'react';
import type { Metadata } from 'next';
import { Montserrat, Montserrat_Alternates } from 'next/font/google';
import { Noto_Sans_Arabic, Noto_Kufi_Arabic } from 'next/font/google';
import Link from 'next/link';

import { Logo } from '@/components/logo';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/utils/cn';
import { Analytics } from '@vercel/analytics/react';

import { Navigation } from './navigation';

import '@/styles/globals.css';

export const dynamic = 'force-dynamic';

// English fonts
const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
});

const montserratAlternates = Montserrat_Alternates({
  variable: '--font-montserrat-alternates',
  weight: ['500', '600', '700'],
  subsets: ['latin'],
});

// Arabic fonts
const notoSansArabic = Noto_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: '--font-arabic-display',
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'HR Business Consultant | استشاري الموارد البشرية',
  description: 'Professional HR consultation platform for Saudi Arabian businesses | منصة استشارات الموارد البشرية للشركات السعودية',
};

export default function RootLayout({ children }: PropsWithChildren) {
  // In a real app, you'd get this from user preferences or URL
  const currentLanguage = 'en'; // or 'ar'
  const direction = currentLanguage === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={currentLanguage} dir={direction}>
      <body 
        className={cn(
          'font-sans antialiased',
          montserrat.variable,
          montserratAlternates.variable,
          notoSansArabic.variable,
          notoKufiArabic.variable,
          currentLanguage === 'ar' && 'arabic-text'
        )}
      >
        <div className='m-auto flex h-full max-w-[1440px] flex-col px-4'>
          <AppBar />
          <main className='relative flex-1'>
            <div className='relative h-full'>{children}</div>
          </main>
          <Footer />
        </div>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}

async function AppBar() {
  return (
    <header className='flex items-center justify-between py-8'>
      <Logo />
      <Navigation />
    </header>
  );
}

function Footer() {
  return (
    <footer className='mt-8 flex flex-col gap-8 text-neutral-400 lg:mt-32'>
      <div className='flex flex-col justify-between gap-8 lg:flex-row'>
        <div>
          <Logo />
        </div>
        <div className='grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-4 lg:gap-16'>
          <div className='flex flex-col gap-2 lg:gap-6'>
            <div className='font-semibold text-neutral-100'>المنتج</div>
            <nav className='flex flex-col gap-2 lg:gap-6'>
              <Link href='/pricing'>الأسعار</Link>
              <Link href='/features'>الميزات</Link>
            </nav>
          </div>
          <div className='flex flex-col gap-2 lg:gap-6'>
            <div className='font-semibold text-neutral-100'>الشركة</div>
            <nav className='flex flex-col gap-2 lg:gap-6'>
              <Link href='/about-us'>من نحن</Link>
              <Link href='/privacy'>سياسة الخصوصية</Link>
            </nav>
          </div>
          <div className='flex flex-col gap-2 lg:gap-6'>
            <div className='font-semibold text-neutral-100'>الدعم</div>
            <nav className='flex flex-col gap-2 lg:gap-6'>
              <Link href='/support'>الحصول على الدعم</Link>
              <Link href='/help'>المساعدة</Link>
            </nav>
          </div>
          <div className='flex flex-col gap-2 lg:gap-6'>
            <div className='font-semibold text-neutral-100'>تابعنا</div>
            <nav className='flex flex-col gap-2 lg:gap-6'>
              <Link href='#'>تويتر</Link>
              <Link href='#'>لينكد إن</Link>
            </nav>
          </div>
        </div>
      </div>
      <div className='border-t border-zinc-800 py-6 text-center'>
        <span className='text-neutral4 text-xs'>
          جميع الحقوق محفوظة {new Date().getFullYear()} © منصة استشارات الموارد البشرية
        </span>
      </div>
    </footer>
  );
}
```

### Step 4: Update Existing Components

#### Enhanced Button Component

Update `src/components/ui/button.tsx`:

```typescript
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { Slot } from '@radix-ui/react-slot';

const buttonVariants = cva(
  'w-fit inline-flex items-center justify-center whitespace-nowrap text-sm rounded-lg font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-saudi-navy focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-professional-900 text-professional-100 hover:bg-professional-800',
        destructive: 'bg-compliance-error text-white hover:bg-red-600',
        outline: 'border-2 border-professional-300 bg-transparent hover:bg-professional-50 hover:text-professional-900',
        secondary: 'bg-professional-100 text-professional-900 hover:bg-professional-200',
        ghost: 'hover:bg-professional-100 hover:text-professional-900',
        link: 'text-saudi-navy underline-offset-4 hover:underline',
        
        // Saudi business variants
        'saudi-primary': 'bg-saudi-navy text-white hover:bg-saudi-navy-light hover:shadow-lg hover:-translate-y-0.5',
        'saudi-secondary': 'border-2 border-saudi-navy text-saudi-navy bg-transparent hover:bg-saudi-navy hover:text-white',
        'saudi-gold': 'bg-saudi-gold text-white hover:bg-saudi-gold-dark hover:shadow-lg',
        
        // Status variants
        success: 'bg-compliance-success text-white hover:bg-green-600',
        warning: 'bg-compliance-warning text-white hover:bg-orange-600',
        pending: 'bg-compliance-pending text-white hover:bg-indigo-600',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

#### Enhanced Input Component

Update `src/components/ui/input.tsx`:

```typescript
import * as React from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  helperText?: string;
  label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, helperText, label, ...props }, ref) => {
    const inputId = React.useId();
    
    return (
      <div className="space-y-2">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-professional-700 rtl:text-right"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(
            'flex h-12 w-full rounded-lg border-2 bg-white px-4 py-3 text-base transition-colors',
            'placeholder:text-professional-400 disabled:cursor-not-allowed disabled:opacity-50',
            'focus:border-saudi-navy focus:outline-none focus:ring-3 focus:ring-saudi-navy/10',
            'rtl:text-right rtl:placeholder:text-right',
            error 
              ? 'border-compliance-error focus:border-compliance-error focus:ring-red-100' 
              : 'border-professional-200 hover:border-professional-300',
            className
          )}
          ref={ref}
          {...props}
        />
        {helperText && (
          <p className={cn(
            'text-sm rtl:text-right',
            error ? 'text-compliance-error' : 'text-professional-600'
          )}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
```

### Step 5: Create Platform-Specific Components

#### Chat Message Component

Create `src/components/hr-platform/chat/MessageBubble.tsx`:

```typescript
'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: any[];
}

interface MessageBubbleProps {
  message: ChatMessage;
  language?: 'ar' | 'en';
  showTimestamp?: boolean;
}

export function MessageBubble({ 
  message, 
  language = 'en',
  showTimestamp = true 
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      'flex w-full',
      isUser ? 'justify-end' : 'justify-start',
      language === 'ar' && isUser && 'justify-start',
      language === 'ar' && !isUser && 'justify-end'
    )}>
      <div className={cn(
        'max-w-[70%] rounded-2xl px-4 py-3 text-base transition-all',
        language === 'ar' && 'text-lg leading-relaxed',
        isUser ? [
          'bg-saudi-navy text-white',
          language === 'ar' ? 'rounded-bl-md' : 'rounded-br-md'
        ] : [
          'bg-professional-100 text-professional-900',
          language === 'ar' ? 'rounded-br-md' : 'rounded-bl-md'
        ]
      )}>
        <div className={cn(
          language === 'ar' && 'text-right font-arabic'
        )}>
          {message.content}
        </div>
        
        {showTimestamp && (
          <div className={cn(
            'mt-1 text-xs opacity-70',
            language === 'ar' && 'text-right'
          )}>
            {message.timestamp.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
        
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 border-t border-white/20 pt-2">
            <div className="text-xs opacity-80">
              {language === 'ar' ? 'المصادر:' : 'Sources:'} {message.sources.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Document Upload Component

Create `src/components/hr-platform/upload/DocumentUploadArea.tsx`:

```typescript
'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/utils/cn';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface DocumentUploadAreaProps {
  onUpload: (files: File[]) => void;
  acceptedTypes?: string[];
  maxSize?: number; // in MB
  maxFiles?: number;
  title?: string;
  subtitle?: string;
  language?: 'ar' | 'en';
  isUploading?: boolean;
  progress?: number;
}

export function DocumentUploadArea({
  onUpload,
  acceptedTypes = ['.pdf', '.doc', '.docx', '.txt'],
  maxSize = 10,
  maxFiles = 5,
  title,
  subtitle,
  language = 'en',
  isUploading = false,
  progress = 0
}: DocumentUploadAreaProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'error' | 'success'>('idle');
  
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      setUploadStatus('error');
      return;
    }
    
    setUploadStatus('success');
    onUpload(acceptedFiles);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: maxSize * 1024 * 1024,
    maxFiles
  });

  const defaultTitle = language === 'ar' 
    ? 'اسحب الملفات هنا أو انقر للرفع'
    : 'Drag files here or click to upload';
    
  const defaultSubtitle = language === 'ar'
    ? `الحد الأقصى ${maxSize} ميجابايت لكل ملف. الملفات المدعومة: ${acceptedTypes.join(', ')}`
    : `Maximum ${maxSize}MB per file. Supported: ${acceptedTypes.join(', ')}`;

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed p-12',
          'transition-all duration-300 ease-in-out',
          'flex flex-col items-center justify-center gap-4 text-center',
          isDragActive ? [
            'border-saudi-navy bg-saudi-navy/5',
          ] : 'border-professional-300 hover:border-saudi-navy hover:bg-saudi-navy/2',
          isUploading && 'pointer-events-none opacity-70',
          uploadStatus === 'error' && 'border-compliance-error bg-red-50',
          uploadStatus === 'success' && 'border-compliance-success bg-green-50'
        )}
      >
        <input {...getInputProps()} />
        
        <div className={cn(
          'rounded-full p-3 transition-colors',
          isDragActive ? 'bg-saudi-navy text-white' : 'bg-professional-100 text-professional-600',
          uploadStatus === 'error' && 'bg-red-100 text-compliance-error',
          uploadStatus === 'success' && 'bg-green-100 text-compliance-success'
        )}>
          {uploadStatus === 'success' ? (
            <CheckCircle size={32} />
          ) : uploadStatus === 'error' ? (
            <AlertCircle size={32} />
          ) : (
            <Upload size={32} />
          )}
        </div>

        <div className="space-y-2">
          <h3 className={cn(
            'text-lg font-semibold text-professional-900',
            language === 'ar' && 'font-arabic-display'
          )}>
            {title || defaultTitle}
          </h3>
          <p className={cn(
            'text-sm text-professional-600 max-w-md',
            language === 'ar' && 'text-base leading-relaxed'
          )}>
            {subtitle || defaultSubtitle}
          </p>
        </div>

        {isUploading && (
          <div className="w-full max-w-xs">
            <div className="bg-professional-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-saudi-navy h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className={cn(
              'text-sm text-professional-600 mt-2',
              language === 'ar' && 'text-right'
            )}>
              {language === 'ar' ? `جاري الرفع... ${progress}%` : `Uploading... ${progress}%`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Compliance Badge Component

Create `src/components/hr-platform/compliance/ComplianceBadge.tsx`:

```typescript
import React from 'react';
import { cn } from '@/utils/cn';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

type ComplianceStatus = 'compliant' | 'non-compliant' | 'pending' | 'needs-attention';

interface ComplianceBadgeProps {
  status: ComplianceStatus;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  language?: 'ar' | 'en';
}

const statusConfig = {
  compliant: {
    icon: CheckCircle,
    textEn: 'Compliant',
    textAr: 'متوافق',
    className: 'bg-compliance-success text-white'
  },
  'non-compliant': {
    icon: XCircle,
    textEn: 'Non-Compliant',
    textAr: 'غير متوافق',
    className: 'bg-compliance-error text-white'
  },
  pending: {
    icon: Clock,
    textEn: 'Pending Review',
    textAr: 'قيد المراجعة',
    className: 'bg-compliance-pending text-white'
  },
  'needs-attention': {
    icon: AlertTriangle,
    textEn: 'Needs Attention',
    textAr: 'يحتاج انتباه',
    className: 'bg-compliance-warning text-white'
  }
};

export function ComplianceBadge({ 
  status, 
  text, 
  size = 'md', 
  showIcon = true,
  language = 'en' 
}: ComplianceBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const displayText = text || (language === 'ar' ? config.textAr : config.textEn);

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      config.className,
      {
        'px-2 py-1 text-xs': size === 'sm',
        'px-3 py-1.5 text-sm': size === 'md', 
        'px-4 py-2 text-base': size === 'lg',
      },
      language === 'ar' && size === 'md' && 'text-base',
      language === 'ar' && 'font-arabic'
    )}>
      {showIcon && <Icon size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} />}
      <span>{displayText}</span>
    </span>
  );
}
```

### Step 6: Example Page Implementation

Create `src/app/hr-consultation/page.tsx` to demonstrate the components:

```typescript
'use client';

import React, { useState } from 'react';
import { MessageBubble } from '@/components/hr-platform/chat/MessageBubble';
import { DocumentUploadArea } from '@/components/hr-platform/upload/DocumentUploadArea';
import { ComplianceBadge } from '@/components/hr-platform/compliance/ComplianceBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function HRConsultationPage() {
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [messages] = useState([
    {
      id: '1',
      role: 'assistant' as const,
      content: language === 'ar' 
        ? 'مرحباً! كيف يمكنني مساعدتك في استشارات قانون العمل السعودي؟'
        : 'Hello! How can I help you with Saudi Labor Law consultations?',
      timestamp: new Date(),
      sources: []
    },
    {
      id: '2',
      role: 'user' as const,
      content: language === 'ar'
        ? 'ما هي حقوق الموظف عند انتهاء عقد العمل؟'
        : 'What are the employee rights when the employment contract ends?',
      timestamp: new Date(),
      sources: []
    },
    {
      id: '3',
      role: 'assistant' as const,
      content: language === 'ar'
        ? 'بموجب نظام العمل السعودي، للموظف الحق في الحصول على مكافأة نهاية الخدمة وأي مستحقات متأخرة. المكافأة تُحسب بناءً على آخر راتب أساسي ومدة الخدمة.'
        : 'Under Saudi Labor Law, the employee has the right to receive end-of-service benefits and any outstanding dues. The benefit is calculated based on the last basic salary and length of service.',
      timestamp: new Date(),
      sources: [{ id: '1', title: 'Saudi Labor Law Article 84' }]
    }
  ]);

  const handleFileUpload = (files: File[]) => {
    console.log('Files uploaded:', files);
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className={cn(
      'min-h-screen bg-bg-secondary p-6',
      language === 'ar' && 'font-arabic'
    )} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className={cn(
              'text-3xl font-bold text-professional-900 mb-2',
              language === 'ar' && 'font-arabic-display'
            )}>
              {language === 'ar' ? 'منصة استشارات الموارد البشرية' : 'HR Business Consultant'}
            </h1>
            <p className="text-professional-600">
              {language === 'ar' 
                ? 'استشارات قانون العمل السعودي للشركات' 
                : 'Saudi Labor Law consultations for businesses'}
            </p>
          </div>
          <Button 
            onClick={toggleLanguage}
            variant="outline"
            className="min-w-[100px]"
          >
            {language === 'ar' ? 'English' : 'العربية'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chat Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-professional-200 h-[600px] flex flex-col">
              {/* Chat Header */}
              <div className="p-6 border-b border-professional-200">
                <h2 className={cn(
                  'text-xl font-semibold text-professional-900 mb-1',
                  language === 'ar' && 'font-arabic-display text-right'
                )}>
                  {language === 'ar' ? 'مساعد قانون العمل' : 'Labor Law Assistant'}
                </h2>
                <p className={cn(
                  'text-professional-600',
                  language === 'ar' && 'text-right'
                )}>
                  {language === 'ar' 
                    ? 'اطرح أسئلتك حول قانون العمل السعودي'
                    : 'Ask questions about Saudi Labor Law'}
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    language={language}
                  />
                ))}
              </div>

              {/* Input Area */}
              <div className="p-6 border-t border-professional-200">
                <div className="flex gap-3">
                  <Input
                    placeholder={language === 'ar' 
                      ? 'اكتب سؤالك هنا...' 
                      : 'Type your question here...'}
                    className="flex-1"
                  />
                  <Button variant="saudi-primary">
                    {language === 'ar' ? 'إرسال' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Document Upload */}
            <div className="bg-white rounded-xl border border-professional-200 p-6">
              <h3 className={cn(
                'text-lg font-semibold text-professional-900 mb-4',
                language === 'ar' && 'font-arabic-display text-right'
              )}>
                {language === 'ar' ? 'رفع الوثائق' : 'Document Upload'}
              </h3>
              <DocumentUploadArea
                onUpload={handleFileUpload}
                language={language}
                title={language === 'ar' ? 'رفع ملفات الشركة' : 'Upload Company Files'}
              />
            </div>

            {/* Compliance Status */}
            <div className="bg-white rounded-xl border border-professional-200 p-6">
              <h3 className={cn(
                'text-lg font-semibold text-professional-900 mb-4',
                language === 'ar' && 'font-arabic-display text-right'
              )}>
                {language === 'ar' ? 'حالة التوافق' : 'Compliance Status'}
              </h3>
              <div className="space-y-3">
                <div className={cn(
                  'flex items-center justify-between',
                  language === 'ar' && 'flex-row-reverse'
                )}>
                  <span className={cn(
                    'text-professional-700',
                    language === 'ar' && 'text-right'
                  )}>
                    {language === 'ar' ? 'عقود العمل' : 'Employment Contracts'}
                  </span>
                  <ComplianceBadge status="compliant" language={language} />
                </div>
                <div className={cn(
                  'flex items-center justify-between',
                  language === 'ar' && 'flex-row-reverse'
                )}>
                  <span className={cn(
                    'text-professional-700',
                    language === 'ar' && 'text-right'
                  )}>
                    {language === 'ar' ? 'ساعات العمل' : 'Working Hours'}
                  </span>
                  <ComplianceBadge status="needs-attention" language={language} />
                </div>
                <div className={cn(
                  'flex items-center justify-between',
                  language === 'ar' && 'flex-row-reverse'
                )}>
                  <span className={cn(
                    'text-professional-700',
                    language === 'ar' && 'text-right'
                  )}>
                    {language === 'ar' ? 'التأمينات' : 'Insurance'}
                  </span>
                  <ComplianceBadge status="pending" language={language} />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-professional-200 p-6">
              <h3 className={cn(
                'text-lg font-semibold text-professional-900 mb-4',
                language === 'ar' && 'font-arabic-display text-right'
              )}>
                {language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
              </h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  {language === 'ar' ? 'إنشاء عقد عمل جديد' : 'Create New Employment Contract'}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  {language === 'ar' ? 'مراجعة السياسات' : 'Review Policies'}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  {language === 'ar' ? 'تقرير التوافق' : 'Compliance Report'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Testing Checklist

### Visual Testing
- [ ] All components render correctly in both Arabic and English
- [ ] RTL layout works properly with Arabic content
- [ ] Fonts load correctly for both languages
- [ ] Colors match the Saudi business theme
- [ ] Responsive design works on mobile/tablet/desktop

### Functionality Testing
- [ ] Language switching works smoothly
- [ ] Form inputs handle Arabic text properly
- [ ] File upload accepts Arabic filenames
- [ ] Chat interface displays messages correctly in both directions
- [ ] Compliance badges show appropriate status

### Accessibility Testing
- [ ] Screen readers work with both languages
- [ ] Keyboard navigation follows proper RTL/LTR order
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators are visible and appropriate

### Performance Testing
- [ ] Page loads quickly with Arabic fonts
- [ ] Component re-renders efficiently on language switch
- [ ] Large file uploads don't block the UI
- [ ] Chat scrolling is smooth with many messages

## Next Steps

1. **Implement remaining components** from `hr-platform-components.md`
2. **Add state management** for language preferences and user data
3. **Integrate with backend** for real chat functionality
4. **Add more sophisticated RTL handling** for complex layouts
5. **Implement dark mode** if required
6. **Add animation and micro-interactions** for better UX
7. **Optimize for Saudi business workflows** based on user feedback

This implementation guide provides a solid foundation for building a professional, bilingual HR consultation platform that meets the cultural and business requirements of Saudi Arabian companies.