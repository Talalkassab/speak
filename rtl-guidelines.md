# RTL Guidelines for HR Business Consultant RAG Platform

## Overview
This guide provides comprehensive instructions for implementing Right-to-Left (RTL) language support in the HR Business Consultant RAG platform, specifically optimized for Arabic language content while maintaining seamless bilingual functionality with English.

## Table of Contents
1. [RTL Implementation Strategy](#rtl-implementation-strategy)
2. [HTML Structure](#html-structure)
3. [CSS Guidelines](#css-guidelines)
4. [Layout Mirroring Rules](#layout-mirroring-rules)
5. [Typography Considerations](#typography-considerations)
6. [Component-Specific Guidelines](#component-specific-guidelines)
7. [Icon and Image Handling](#icon-and-image-handling)
8. [Form Elements](#form-elements)
9. [Navigation Patterns](#navigation-patterns)
10. [Testing Checklist](#testing-checklist)

## RTL Implementation Strategy

### Approach: Logical Properties + Direction Attributes
We use a hybrid approach combining CSS logical properties with HTML direction attributes for maximum compatibility and flexibility.

```html
<!-- Document-level language and direction -->
<html lang="ar" dir="rtl">
<!-- OR for English -->
<html lang="en" dir="ltr">
```

### Dynamic Direction Switching
For bilingual content, implement dynamic direction switching:

```javascript
// Direction switching utility
function setLanguageDirection(language) {
  const html = document.documentElement;
  if (language === 'ar') {
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
  } else {
    html.setAttribute('dir', 'ltr');
    html.setAttribute('lang', 'en');
  }
}
```

## HTML Structure

### Document Structure
```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>منصة الاستشارات الموارد البشرية</title>
</head>
<body>
  <!-- Main content with proper direction -->
</body>
</html>
```

### Mixed Content Handling
For sections with mixed language content:

```html
<!-- Arabic section in English document -->
<div dir="rtl" lang="ar">
  <p>هذا نص باللغة العربية</p>
</div>

<!-- English section in Arabic document -->
<div dir="ltr" lang="en">
  <p>This is English text</p>
</div>
```

### Best Practices for HTML
- Always specify `dir` and `lang` attributes at the appropriate level
- Use semantic HTML elements (`<main>`, `<nav>`, `<article>`, `<section>`)
- Ensure proper heading hierarchy works in both directions
- Use `<bdi>` (bi-directional isolation) for user-generated content

## CSS Guidelines

### CSS Logical Properties (Preferred Method)
Use CSS logical properties instead of physical properties for automatic RTL support:

```css
/* ✅ Good - Uses logical properties */
.container {
  margin-inline-start: 16px;  /* Instead of margin-left */
  margin-inline-end: 8px;     /* Instead of margin-right */
  padding-inline: 24px;       /* Instead of padding-left/right */
  border-inline-start: 2px solid #1a365d; /* Instead of border-left */
}

/* ✅ Good - Block direction properties (same in LTR/RTL) */
.container {
  margin-block-start: 16px;   /* Instead of margin-top */
  margin-block-end: 16px;     /* Instead of margin-bottom */
  padding-block: 12px;        /* Instead of padding-top/bottom */
}
```

### Direction-Specific CSS (When Needed)
For cases where logical properties aren't sufficient:

```css
/* Direction-specific styling */
[dir="ltr"] .chevron::before {
  content: "→";
  margin-inline-end: 8px;
}

[dir="rtl"] .chevron::before {
  content: "←";
  margin-inline-end: 8px;
}

/* Transform-based mirroring for icons */
[dir="rtl"] .icon-arrow {
  transform: scaleX(-1);
}
```

### Tailwind CSS RTL Implementation
Using Tailwind with our theme extension:

```html
<!-- Logical spacing classes -->
<div class="ps-4 pe-2 ms-6 me-4">
  <!-- ps = padding-inline-start, pe = padding-inline-end -->
  <!-- ms = margin-inline-start, me = margin-inline-end -->
</div>

<!-- Direction-specific classes -->
<div class="ltr:text-left rtl:text-right">
  <p class="ltr:ml-4 rtl:mr-4">Content with conditional margins</p>
</div>
```

## Layout Mirroring Rules

### What Should Mirror
✅ **Elements that SHOULD mirror:**
- Navigation menus (horizontal)
- Breadcrumbs
- Progress bars and steppers
- Tabs
- Pagination
- Data tables (column order)
- Form field alignment
- Button groups
- Icon buttons with directional meaning
- Sidebar positioning
- Modal positioning
- Tooltips and popovers positioning

### What Should NOT Mirror
❌ **Elements that should NOT mirror:**
- Logos and brand elements
- Images and photos (unless they have directional meaning)
- Icons without directional meaning (search, settings, user)
- Charts and graphs (unless culturally specific)
- Phone numbers and email addresses
- Code snippets
- Mathematical formulas
- Maps (unless culturally specific)

## Typography Considerations

### Font Selection
```css
/* Arabic-optimized font stack */
.arabic-text {
  font-family: 'Noto Sans Arabic', 'Cairo', 'Tajawal', system-ui, sans-serif;
  font-size: 1.125rem; /* Minimum 18px for Arabic readability */
  line-height: 1.625;   /* Extra line-height for Arabic */
  font-weight: 500;     /* Medium weight for better Arabic rendering */
}

/* Bilingual font stack */
.bilingual-text {
  font-family: 'Inter', 'Noto Sans Arabic', system-ui, sans-serif;
}

[dir="rtl"] .bilingual-text {
  font-family: 'Noto Sans Arabic', 'Inter', system-ui, sans-serif;
  line-height: 1.625;
}
```

### Text Alignment
```css
/* Proper text alignment for each direction */
[dir="ltr"] .text-start { text-align: left; }
[dir="rtl"] .text-start { text-align: right; }

[dir="ltr"] .text-end { text-align: right; }
[dir="rtl"] .text-end { text-align: left; }

/* Center remains the same */
.text-center { text-align: center; }
```

### Arabic Typography Best Practices
- **Minimum font size**: 18px for body text in Arabic
- **Line height**: 1.625 minimum for Arabic text
- **Letter spacing**: Never use letter-spacing with Arabic text
- **Text decoration**: Underlines may not work well with Arabic diacritics
- **Font weight**: Use medium (500) as standard weight for Arabic

## Component-Specific Guidelines

### Navigation Components

#### Header Navigation
```css
/* Header navigation RTL support */
.header-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

[dir="ltr"] .header-nav {
  justify-content: flex-end;
}

[dir="rtl"] .header-nav {
  justify-content: flex-start;
}

/* Logo positioning */
[dir="ltr"] .logo {
  margin-inline-end: auto;
}

[dir="rtl"] .logo {
  margin-inline-start: auto;
}
```

#### Sidebar Navigation
```css
/* Sidebar positioning */
.sidebar {
  position: fixed;
  top: 0;
  width: 280px;
  height: 100vh;
  background: var(--bg-secondary);
  border-color: var(--professional-200);
  transition: transform 0.3s ease;
}

[dir="ltr"] .sidebar {
  left: 0;
  border-right-width: 1px;
}

[dir="rtl"] .sidebar {
  right: 0;
  border-left-width: 1px;
}

/* Main content adjustment */
[dir="ltr"] .main-content {
  margin-left: 280px;
}

[dir="rtl"] .main-content {
  margin-right: 280px;
}
```

#### Breadcrumbs
```html
<!-- RTL-aware breadcrumb separator -->
<nav class="breadcrumb">
  <span>الرئيسية</span>
  <span class="separator">/</span>
  <span>الاستشارات</span>
  <span class="separator">/</span>
  <span>قانون العمل</span>
</nav>

<style>
[dir="rtl"] .breadcrumb {
  direction: rtl;
}

[dir="rtl"] .separator::before {
  content: "\\";
}

[dir="ltr"] .separator::before {
  content: "/";
}
</style>
```

### Form Elements

#### Input Fields
```css
.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--professional-200);
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

[dir="rtl"] .form-input {
  text-align: right;
}

[dir="ltr"] .form-input {
  text-align: left;
}

/* Placeholder text styling */
.form-input::placeholder {
  color: var(--professional-400);
  opacity: 1;
}

[dir="rtl"] .form-input::placeholder {
  text-align: right;
}
```

#### Select Dropdowns
```css
.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-size: 16px;
}

[dir="ltr"] .form-select {
  background-position: right 12px center;
  padding-right: 40px;
  padding-left: 16px;
}

[dir="rtl"] .form-select {
  background-position: left 12px center;
  padding-left: 40px;
  padding-right: 16px;
}
```

#### Checkboxes and Radio Buttons
```html
<!-- RTL-aware checkbox layout -->
<label class="checkbox-label">
  <input type="checkbox" class="checkbox-input">
  <span class="checkbox-text">أوافق على الشروط والأحكام</span>
</label>

<style>
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

[dir="rtl"] .checkbox-label {
  flex-direction: row-reverse;
}

[dir="ltr"] .checkbox-label {
  flex-direction: row;
}
</style>
```

### Data Display Components

#### Tables
```css
.data-table {
  width: 100%;
  border-collapse: collapse;
}

/* Table direction handling */
[dir="rtl"] .data-table {
  direction: rtl;
}

[dir="ltr"] .data-table {
  direction: ltr;
}

/* Header alignment */
[dir="rtl"] .table-header {
  text-align: right;
}

[dir="ltr"] .table-header {
  text-align: left;
}

/* Numeric columns should maintain LTR in RTL contexts */
.numeric-column {
  direction: ltr;
  text-align: right;
}
```

#### Cards
```css
.card {
  background: white;
  border: 1px solid var(--professional-200);
  border-radius: 12px;
  padding: 24px;
  transition: box-shadow 0.2s ease;
}

/* Card header with icon */
.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

[dir="ltr"] .card-header .icon {
  margin-right: 12px;
}

[dir="rtl"] .card-header .icon {
  margin-left: 12px;
}

/* Card actions */
.card-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

[dir="ltr"] .card-actions {
  justify-content: flex-end;
}

[dir="rtl"] .card-actions {
  justify-content: flex-start;
}
```

### Chat Interface

#### Chat Messages
```css
.chat-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  word-wrap: break-word;
}

/* User messages */
.message-user {
  background: var(--saudi-navy);
  color: white;
  align-self: flex-end;
}

[dir="ltr"] .message-user {
  border-bottom-right-radius: 4px;
}

[dir="rtl"] .message-user {
  border-bottom-left-radius: 4px;
  align-self: flex-start;
}

/* AI assistant messages */
.message-assistant {
  background: var(--professional-100);
  color: var(--professional-900);
  align-self: flex-start;
}

[dir="ltr"] .message-assistant {
  border-bottom-left-radius: 4px;
}

[dir="rtl"] .message-assistant {
  border-bottom-right-radius: 4px;
  align-self: flex-end;
}
```

#### Chat Input
```css
.chat-input-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--professional-200);
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--professional-200);
  border-radius: 24px;
  resize: none;
  min-height: 44px;
  max-height: 120px;
}

[dir="rtl"] .chat-input {
  text-align: right;
}

.chat-send-button {
  padding: 8px;
  border-radius: 50%;
  background: var(--saudi-navy);
  color: white;
  border: none;
  cursor: pointer;
  min-width: 44px;
  min-height: 44px;
}
```

## Icon and Image Handling

### Directional Icons
```css
/* Icons that should mirror */
.icon-arrow,
.icon-chevron,
.icon-back,
.icon-forward {
  transition: transform 0.2s ease;
}

[dir="rtl"] .icon-arrow,
[dir="rtl"] .icon-chevron,
[dir="rtl"] .icon-back,
[dir="rtl"] .icon-forward {
  transform: scaleX(-1);
}

/* Icons that should NOT mirror */
.icon-search,
.icon-settings,
.icon-user,
.icon-download,
.icon-upload {
  /* No transformation needed */
}
```

### Image Considerations
```css
/* Images that might need mirroring (rare) */
.directional-image {
  transition: transform 0.2s ease;
}

[dir="rtl"] .directional-image.mirror-rtl {
  transform: scaleX(-1);
}

/* Prevent mirroring for most images */
.content-image,
.profile-image,
.logo-image {
  /* Explicitly prevent mirroring */
  transform: none !important;
}
```

## Form Elements

### Label Positioning
```html
<!-- Proper label-input relationship for RTL -->
<div class="form-field">
  <label for="username" class="form-label">اسم المستخدم</label>
  <input type="text" id="username" class="form-input">
</div>

<style>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-weight: 500;
  color: var(--professional-700);
}

[dir="rtl"] .form-label {
  text-align: right;
}

[dir="ltr"] .form-label {
  text-align: left;
}
</style>
```

### Form Validation
```css
.form-error {
  color: var(--compliance-error);
  font-size: 0.875rem;
  margin-top: 4px;
}

[dir="rtl"] .form-error {
  text-align: right;
}

[dir="ltr"] .form-error {
  text-align: left;
}

/* Error icon positioning */
.form-input.error {
  border-color: var(--compliance-error);
  background-image: url("data:image/svg+xml;..."); /* Error icon SVG */
  background-repeat: no-repeat;
  background-size: 16px;
}

[dir="ltr"] .form-input.error {
  background-position: right 12px center;
  padding-right: 40px;
}

[dir="rtl"] .form-input.error {
  background-position: left 12px center;
  padding-left: 40px;
}
```

## Navigation Patterns

### Mobile Navigation
```css
/* Mobile menu toggle */
.mobile-menu-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
}

[dir="ltr"] .mobile-menu-toggle {
  margin-left: auto;
}

[dir="rtl"] .mobile-menu-toggle {
  margin-right: auto;
}

/* Mobile menu sliding */
.mobile-menu {
  position: fixed;
  top: 0;
  width: 280px;
  height: 100vh;
  background: white;
  transition: transform 0.3s ease;
  z-index: 1050;
}

[dir="ltr"] .mobile-menu {
  left: 0;
  transform: translateX(-100%);
}

[dir="rtl"] .mobile-menu {
  right: 0;
  transform: translateX(100%);
}

.mobile-menu.open {
  transform: translateX(0);
}
```

### Pagination
```html
<!-- RTL-aware pagination -->
<nav class="pagination">
  <button class="page-btn prev" dir="ltr">
    <span class="sr-only">السابق</span>
    <svg class="icon-prev">...</svg>
  </button>
  
  <div class="page-numbers">
    <button class="page-btn">1</button>
    <button class="page-btn active">2</button>
    <button class="page-btn">3</button>
  </div>
  
  <button class="page-btn next" dir="ltr">
    <span class="sr-only">التالي</span>
    <svg class="icon-next">...</svg>
  </button>
</nav>

<style>
.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
}

[dir="rtl"] .pagination {
  flex-direction: row-reverse;
}

.page-numbers {
  display: flex;
  gap: 4px;
}
</style>
```

## Testing Checklist

### Visual Testing
- [ ] All text aligns correctly in both directions
- [ ] Icons and images position correctly
- [ ] Navigation elements mirror appropriately
- [ ] Form elements align and function correctly
- [ ] Margins and padding work as expected
- [ ] Scroll behavior works correctly
- [ ] Animations and transitions work in both directions

### Functional Testing
- [ ] Tab navigation follows logical order in both directions
- [ ] Form submission works correctly
- [ ] Keyboard navigation functions properly
- [ ] Screen readers announce content correctly
- [ ] Search and filtering work with Arabic text
- [ ] URLs and routing handle RTL content

### Content Testing
- [ ] Arabic text renders properly with correct fonts
- [ ] Mixed content (Arabic/English) displays correctly
- [ ] Long Arabic words break appropriately
- [ ] Numbers and dates display correctly in context
- [ ] Legal and compliance text is accurate in Arabic

### Browser Testing
Test across major browsers with RTL support:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Device Testing
- [ ] Desktop layouts (1920px+, 1366px, 1024px)
- [ ] Tablet layouts (768px, 1024px)
- [ ] Mobile layouts (375px, 414px, 360px)
- [ ] Portrait and landscape orientations

## Implementation Example

Here's a complete example showing proper RTL implementation for a typical HR platform component:

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>استشارة قانون العمل السعودي</title>
  <link href="./output.css" rel="stylesheet">
</head>
<body class="font-arabic bg-bg-primary">
  <div class="max-w-screen-xl mx-auto px-4">
    <!-- Header -->
    <header class="flex items-center justify-between py-6 border-b border-professional-200">
      <div class="flex items-center gap-4">
        <img src="logo.svg" alt="الشعار" class="h-10">
        <h1 class="text-xl font-bold text-saudi-navy">منصة الاستشارات</h1>
      </div>
      <nav class="flex items-center gap-6">
        <a href="#" class="text-professional-600 hover:text-saudi-navy">الرئيسية</a>
        <a href="#" class="text-professional-600 hover:text-saudi-navy">الاستشارات</a>
        <a href="#" class="text-professional-600 hover:text-saudi-navy">المساعدة</a>
      </nav>
    </header>
    
    <!-- Main Content -->
    <main class="py-8">
      <div class="grid grid-cols-12 gap-8">
        <!-- Sidebar -->
        <aside class="col-span-3">
          <div class="bg-white border border-professional-200 rounded-xl p-6">
            <h2 class="font-bold text-professional-900 mb-4">فئات الاستشارة</h2>
            <nav class="space-y-2">
              <a href="#" class="block p-3 rounded-lg hover:bg-professional-50 text-professional-600">
                عقود العمل
              </a>
              <a href="#" class="block p-3 rounded-lg bg-saudi-navy text-white">
                قانون العمل السعودي
              </a>
              <a href="#" class="block p-3 rounded-lg hover:bg-professional-50 text-professional-600">
                التأمينات الاجتماعية
              </a>
            </nav>
          </div>
        </aside>
        
        <!-- Chat Interface -->
        <section class="col-span-9">
          <div class="bg-white border border-professional-200 rounded-xl h-96 flex flex-col">
            <!-- Chat Header -->
            <div class="px-6 py-4 border-b border-professional-200">
              <h3 class="font-bold text-professional-900">مساعد قانون العمل</h3>
              <p class="text-sm text-professional-600">اطرح سؤالك حول قانون العمل السعودي</p>
            </div>
            
            <!-- Chat Messages -->
            <div class="flex-1 p-6 space-y-4 overflow-y-auto">
              <!-- AI Message -->
              <div class="flex justify-start">
                <div class="max-w-xs bg-professional-100 text-professional-900 p-4 rounded-2xl rounded-br-md">
                  مرحباً! كيف يمكنني مساعدتك في استشارات قانون العمل السعودي؟
                </div>
              </div>
              
              <!-- User Message -->
              <div class="flex justify-end">
                <div class="max-w-xs bg-saudi-navy text-white p-4 rounded-2xl rounded-bl-md">
                  ما هي حقوق الموظف عند انتهاء عقد العمل؟
                </div>
              </div>
            </div>
            
            <!-- Chat Input -->
            <div class="p-4 border-t border-professional-200">
              <div class="flex gap-3">
                <input
                  type="text"
                  placeholder="اكتب سؤالك هنا..."
                  class="flex-1 px-4 py-3 border-2 border-professional-200 rounded-full text-right focus:border-saudi-navy focus:outline-none"
                >
                <button class="bg-saudi-navy text-white p-3 rounded-full hover:bg-saudi-navy-light transition-colors">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12l8-5-8-5-8 5 8 5z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</body>
</html>
```

This comprehensive RTL guide ensures that the HR Business Consultant RAG platform provides an excellent experience for Arabic-speaking users while maintaining the professional standards required for Saudi business environments.