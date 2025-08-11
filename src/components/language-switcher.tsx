'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

export type Language = 'ar' | 'en';

interface LanguageSwitcherProps {
  onLanguageChange?: (language: Language) => void;
  currentLanguage?: Language;
  className?: string;
}

interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
}

const languages: LanguageOption[] = [
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦'
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸'
  }
];

export function LanguageSwitcher({ 
  onLanguageChange, 
  currentLanguage = 'ar',
  className = ''
}: LanguageSwitcherProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(currentLanguage);

  useEffect(() => {
    // Apply language-specific styling to document
    const html = document.documentElement;
    const body = document.body;
    
    if (selectedLanguage === 'ar') {
      html.setAttribute('dir', 'rtl');
      html.setAttribute('lang', 'ar');
      body.classList.add('font-arabic');
      body.classList.remove('font-english');
    } else {
      html.setAttribute('dir', 'ltr');
      html.setAttribute('lang', 'en');
      body.classList.add('font-english');
      body.classList.remove('font-arabic');
    }
  }, [selectedLanguage]);

  const handleLanguageChange = (language: Language) => {
    setSelectedLanguage(language);
    onLanguageChange?.(language);
  };

  const currentLang = languages.find(lang => lang.code === selectedLanguage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={`gap-2 ${className}`}
        >
          <Globe size={16} />
          <span className="hidden sm:inline">
            {currentLang?.flag} {currentLang?.nativeName}
          </span>
          <span className="sm:hidden">
            {currentLang?.flag}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`gap-3 ${selectedLanguage === language.code ? 'bg-gray-100' : ''}`}
          >
            <span className="text-lg">{language.flag}</span>
            <div className="flex flex-col">
              <span className="font-medium">{language.nativeName}</span>
              <span className="text-xs text-gray-500">{language.name}</span>
            </div>
            {selectedLanguage === language.code && (
              <span className="ml-auto text-saudi-green">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Translation hook for components
export function useTranslation() {
  const [language, setLanguage] = useState<Language>('ar');

  useEffect(() => {
    // Get language from document or localStorage
    const htmlLang = document.documentElement.lang as Language;
    if (htmlLang === 'ar' || htmlLang === 'en') {
      setLanguage(htmlLang);
    }
  }, []);

  const t = (translations: Record<Language, string>) => {
    return translations[language] || translations['en'] || '';
  };

  return { t, language, setLanguage };
}