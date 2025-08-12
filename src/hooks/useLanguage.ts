'use client';

import { useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

export const useLanguage = () => {
  const [language, setLanguage] = useState<Language>('ar');

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('preferred-language') as Language;
    if (saved && (saved === 'ar' || saved === 'en')) {
      setLanguage(saved);
    }
    
    // Set document direction
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    const newLanguage = language === 'ar' ? 'en' : 'ar';
    setLanguage(newLanguage);
    localStorage.setItem('preferred-language', newLanguage);
  };

  const setLanguagePreference = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  return {
    language,
    isRTL: language === 'ar',
    toggleLanguage,
    setLanguagePreference
  };
};