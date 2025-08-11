# HR Business Consultant RAG Platform - Design System

## Overview
This design system is specifically crafted for an HR Business Consultant RAG platform targeting Saudi Arabian companies. It emphasizes trust, professionalism, and cultural sensitivity while supporting both Arabic (RTL) and English (LTR) languages.

## Design Principles

### 1. Professional Authority
- Clean, structured layouts that convey expertise
- Authoritative typography hierarchy
- Conservative color choices appropriate for legal/HR contexts
- Clear visual separation between information levels

### 2. Cultural Sensitivity
- Saudi business culture considerations
- Professional color palette avoiding overly vibrant colors
- Respect for Arabic typography and reading patterns
- Conservative design approach suitable for government/corporate environments

### 3. Bilingual Excellence
- Native RTL support for Arabic content
- Seamless LTR/RTL transitions
- Typography optimized for both languages
- Icon and layout mirroring considerations

### 4. Trust & Reliability
- Consistent visual patterns
- Clear information hierarchy
- Professional status indicators
- Transparent source attribution

## Color System

### Primary Palette
Our primary colors reflect trust, professionalism, and the Saudi business environment:

```css
/* Saudi Business Professional */
--saudi-navy: #1a365d;        /* Deep professional blue */
--saudi-navy-light: #2c5282;  /* Lighter navy for hover states */
--saudi-navy-dark: #0c1c2e;   /* Darker navy for emphasis */

/* Government Green (inspired by Saudi flag) */
--saudi-green: #0f7b0f;       /* Professional green */
--saudi-green-light: #38a169; /* Lighter green for success states */
--saudi-green-dark: #065f46;  /* Darker green for emphasis */

/* Professional Gold (Saudi heritage) */
--saudi-gold: #d69e2e;        /* Accent gold */
--saudi-gold-light: #ecc94b;  /* Light gold for highlights */
--saudi-gold-dark: #b7791f;   /* Dark gold for emphasis */
```

### Semantic Colors
```css
/* Status Colors */
--compliance-success: #22c55e;  /* Green for compliant status */
--compliance-warning: #f59e0b;  /* Amber for attention needed */
--compliance-error: #ef4444;    /* Red for non-compliant */
--compliance-pending: #6366f1;  /* Indigo for pending review */

/* Information Hierarchy */
--info-primary: #0ea5e9;       /* Sky blue for primary information */
--info-secondary: #64748b;     /* Slate for secondary information */
--info-subtle: #94a3b8;        /* Light slate for subtle information */
```

### Neutral Palette
```css
/* Professional Grays */
--gray-50: #f8fafc;
--gray-100: #f1f5f9;
--gray-200: #e2e8f0;
--gray-300: #cbd5e1;
--gray-400: #94a3b8;
--gray-500: #64748b;
--gray-600: #475569;
--gray-700: #334155;
--gray-800: #1e293b;
--gray-900: #0f172a;

/* Background Colors */
--bg-primary: #ffffff;         /* Pure white for main backgrounds */
--bg-secondary: #f8fafc;       /* Off-white for secondary backgrounds */
--bg-tertiary: #f1f5f9;        /* Light gray for tertiary backgrounds */
--bg-elevated: #ffffff;        /* White for elevated surfaces */
```

## Typography System

### Font Families

#### Arabic Typography
```css
/* Arabic Primary - Professional and highly readable */
font-family: 'Noto Sans Arabic', 'Cairo', 'Tajawal', system-ui, sans-serif;

/* Arabic Display - For headings and emphasis */
font-family: 'Noto Kufi Arabic', 'Cairo', 'Amiri', serif;
```

#### English Typography
```css
/* English Primary - Clean and professional */
font-family: 'Inter', 'Montserrat', system-ui, -apple-system, sans-serif;

/* English Display - For headings */
font-family: 'Inter', 'Montserrat Alternates', system-ui, sans-serif;
```

### Typography Scale
```css
/* Font Sizes */
--text-xs: 0.75rem;     /* 12px - Fine print */
--text-sm: 0.875rem;    /* 14px - Secondary text */
--text-base: 1rem;      /* 16px - Body text */
--text-lg: 1.125rem;    /* 18px - Large body */
--text-xl: 1.25rem;     /* 20px - Small headings */
--text-2xl: 1.5rem;     /* 24px - Medium headings */
--text-3xl: 1.875rem;   /* 30px - Large headings */
--text-4xl: 2.25rem;    /* 36px - Extra large headings */
--text-5xl: 3rem;       /* 48px - Display headings */

/* Font Weights */
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;

/* Line Heights */
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;
```

### Typography Usage Guidelines

#### Arabic Text
- Use 18px (text-lg) minimum for body text in Arabic for better readability
- Increase line-height by 0.125 compared to English text
- Use medium weight (500) as the standard for Arabic body text
- Headers should use Noto Kufi Arabic for better visual hierarchy

#### English Text
- Use 16px (text-base) for standard body text
- Use Inter font for clean, professional appearance
- Use font-medium (500) for important labels and buttons

## Spacing System

### Base Unit: 4px
Our spacing system follows a 4px base unit for consistent rhythm and alignment.

```css
/* Spacing Scale */
--space-0: 0px;
--space-px: 1px;
--space-0.5: 2px;
--space-1: 4px;
--space-1.5: 6px;
--space-2: 8px;
--space-2.5: 10px;
--space-3: 12px;
--space-3.5: 14px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 28px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
--space-32: 128px;
```

### Component Spacing Guidelines
- **Buttons**: Padding of 12px horizontal, 8px vertical (space-3 x space-2)
- **Form Fields**: 16px padding (space-4)
- **Cards**: 24px padding (space-6)
- **Sections**: 48px vertical spacing (space-12)
- **Page Margins**: 32px on desktop, 16px on mobile

## Component Specifications

### Buttons

#### Primary Button (CTA)
```css
background: var(--saudi-navy);
color: white;
padding: 12px 24px;
border-radius: 8px;
font-weight: 500;
font-size: 16px;
transition: all 0.2s ease;

hover {
  background: var(--saudi-navy-light);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(26, 54, 93, 0.3);
}
```

#### Secondary Button
```css
background: transparent;
color: var(--saudi-navy);
border: 2px solid var(--saudi-navy);
padding: 10px 22px; /* Account for border */
border-radius: 8px;
font-weight: 500;
font-size: 16px;

hover {
  background: var(--saudi-navy);
  color: white;
}
```

#### Success Button (Compliance)
```css
background: var(--compliance-success);
color: white;
padding: 12px 24px;
border-radius: 8px;
font-weight: 500;
```

#### Warning Button
```css
background: var(--compliance-warning);
color: white;
padding: 12px 24px;
border-radius: 8px;
font-weight: 500;
```

### Form Fields

#### Input Field
```css
background: white;
border: 2px solid var(--gray-200);
border-radius: 8px;
padding: 12px 16px;
font-size: 16px;
color: var(--gray-900);
transition: border-color 0.2s ease;

focus {
  border-color: var(--saudi-navy);
  box-shadow: 0 0 0 3px rgba(26, 54, 93, 0.1);
  outline: none;
}

/* RTL Support */
[dir="rtl"] & {
  text-align: right;
}
```

#### Select Dropdown
```css
background: white;
border: 2px solid var(--gray-200);
border-radius: 8px;
padding: 12px 16px;
font-size: 16px;
background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
background-position: right 12px center;
background-repeat: no-repeat;
background-size: 16px;

/* RTL Support */
[dir="rtl"] & {
  background-position: left 12px center;
}
```

### Cards

#### Standard Card
```css
background: white;
border: 1px solid var(--gray-200);
border-radius: 12px;
padding: 24px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
transition: box-shadow 0.2s ease;

hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

#### Elevated Card (Important Information)
```css
background: white;
border: 1px solid var(--gray-200);
border-radius: 12px;
padding: 24px;
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.1);
```

#### Status Card
```css
/* Success Status */
background: rgba(34, 197, 94, 0.05);
border: 1px solid rgba(34, 197, 94, 0.2);
border-left: 4px solid var(--compliance-success);

/* Warning Status */
background: rgba(245, 158, 11, 0.05);
border: 1px solid rgba(245, 158, 11, 0.2);
border-left: 4px solid var(--compliance-warning);

/* Error Status */
background: rgba(239, 68, 68, 0.05);
border: 1px solid rgba(239, 68, 68, 0.2);
border-left: 4px solid var(--compliance-error);

/* RTL Support */
[dir="rtl"] & {
  border-left: 1px solid;
  border-right: 4px solid;
}
```

## Platform-Specific Components

### Document Upload Area
```css
border: 2px dashed var(--gray-300);
border-radius: 12px;
padding: 48px 24px;
text-align: center;
background: var(--gray-50);
transition: all 0.2s ease;

hover {
  border-color: var(--saudi-navy);
  background: rgba(26, 54, 93, 0.02);
}

/* Drag active state */
&.drag-active {
  border-color: var(--saudi-navy);
  background: rgba(26, 54, 93, 0.05);
}
```

### Chat Message Bubble

#### User Message
```css
background: var(--saudi-navy);
color: white;
padding: 12px 16px;
border-radius: 18px 18px 4px 18px;
margin-left: auto;
max-width: 70%;

/* RTL Support */
[dir="rtl"] & {
  border-radius: 18px 18px 18px 4px;
  margin-left: 0;
  margin-right: auto;
}
```

#### AI Assistant Message
```css
background: var(--gray-100);
color: var(--gray-900);
padding: 12px 16px;
border-radius: 18px 18px 18px 4px;
margin-right: auto;
max-width: 70%;

/* RTL Support */
[dir="rtl"] & {
  border-radius: 18px 18px 4px 18px;
  margin-right: 0;
  margin-left: auto;
}
```

### Compliance Status Badge
```css
/* Compliant */
background: var(--compliance-success);
color: white;
padding: 4px 12px;
border-radius: 16px;
font-size: 14px;
font-weight: 500;

/* Non-Compliant */
background: var(--compliance-error);
color: white;

/* Under Review */
background: var(--compliance-warning);
color: white;

/* Pending */
background: var(--compliance-pending);
color: white;
```

### Source Attribution
```css
background: var(--bg-tertiary);
border: 1px solid var(--gray-200);
border-radius: 8px;
padding: 16px;
margin-top: 16px;
font-size: 14px;
color: var(--gray-600);

.source-title {
  font-weight: 600;
  color: var(--saudi-navy);
  margin-bottom: 4px;
}

.source-type {
  background: var(--saudi-gold);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
}
```

## Navigation Components

### Primary Navigation
```css
background: white;
border-bottom: 1px solid var(--gray-200);
padding: 16px 0;

.nav-link {
  color: var(--gray-600);
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: var(--saudi-navy);
  background: rgba(26, 54, 93, 0.05);
}

.nav-link.active {
  color: var(--saudi-navy);
  background: rgba(26, 54, 93, 0.1);
}
```

### Sidebar Navigation
```css
background: var(--bg-secondary);
border-right: 1px solid var(--gray-200);
padding: 24px;

/* RTL Support */
[dir="rtl"] & {
  border-right: none;
  border-left: 1px solid var(--gray-200);
}

.sidebar-section {
  margin-bottom: 32px;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  color: var(--gray-600);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.sidebar-link:hover {
  background: white;
  color: var(--saudi-navy);
}

.sidebar-link.active {
  background: var(--saudi-navy);
  color: white;
}
```

## Responsive Breakpoints

```css
/* Mobile First Approach */
--breakpoint-sm: 640px;   /* Small devices (landscape phones) */
--breakpoint-md: 768px;   /* Medium devices (tablets) */
--breakpoint-lg: 1024px;  /* Large devices (desktops) */
--breakpoint-xl: 1280px;  /* Extra large devices */
--breakpoint-2xl: 1536px; /* 2X Extra large devices */
```

### Responsive Design Guidelines

#### Mobile (< 768px)
- Single column layout
- Full-width components
- 16px side margins
- Collapsible navigation
- Touch-friendly button sizes (44px minimum)

#### Tablet (768px - 1024px)
- Two-column layout where appropriate
- 24px side margins
- Sidebar navigation becomes collapsible
- Optimized for both portrait and landscape

#### Desktop (> 1024px)
- Multi-column layouts
- Fixed sidebar navigation
- 32px side margins
- Hover states fully active
- Maximum content width of 1440px

## Animation & Transitions

### Standard Transitions
```css
/* Default transition for interactive elements */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* Slower transition for layout changes */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Fast transition for micro-interactions */
transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
```

### Hover Effects
```css
/* Subtle lift for cards */
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

/* Button hover */
transform: translateY(-1px);
box-shadow: 0 4px 8px rgba(26, 54, 93, 0.3);
```

### Loading States
```css
/* Skeleton loader */
background: linear-gradient(90deg, var(--gray-200) 25%, var(--gray-100) 50%, var(--gray-200) 75%);
background-size: 200% 100%;
animation: loading 1.5s infinite;

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

## Accessibility Guidelines

### Focus States
- All interactive elements must have visible focus indicators
- Focus indicators should be 2px solid with 2px offset
- Use high contrast colors for focus states (saudi-navy or compliance-success)

### Color Contrast
- All text must meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Status colors have been tested for accessibility
- Never rely on color alone to convey information

### Arabic Language Considerations
- Ensure proper RTL text flow
- Use appropriate Arabic fonts that support all diacritics
- Consider Arabic text expansion (typically 20-30% longer than English)
- Respect Arabic typography rules (no letter-spacing, proper line-height)

## Implementation Notes

### CSS Custom Properties
All design tokens should be implemented as CSS custom properties for easy theming and maintenance.

### Tailwind Integration
This design system extends the existing Tailwind configuration with custom colors, fonts, and utilities specific to the Saudi HR business context.

### Component Library
Components should be built using the existing shadcn/ui foundation but styled according to this design system's specifications.

### Cultural Sensitivity Testing
- Review designs with Saudi business professionals
- Test with Arabic content at various lengths
- Validate cultural appropriateness of visual elements
- Ensure compliance with local business practices

This design system provides a solid foundation for building a professional, culturally-sensitive HR platform that serves Saudi Arabian companies with both Arabic and English language support.