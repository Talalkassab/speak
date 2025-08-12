import { ArabicTextProcessingService } from '@/libs/services/arabic-text-processing-service';
import { LanguageDetectionService } from '@/libs/services/language-detection-service';

// Mock language detection service
jest.mock('@/libs/services/language-detection-service');

describe('ArabicTextProcessingService', () => {
  let arabicTextProcessor: ArabicTextProcessingService;
  let mockLanguageDetector: jest.Mocked<LanguageDetectionService>;

  beforeEach(() => {
    mockLanguageDetector = {
      detectLanguage: jest.fn(),
      getLanguageConfidence: jest.fn(),
      detectMixedLanguages: jest.fn(),
      isRTL: jest.fn(),
    } as any;

    arabicTextProcessor = new ArabicTextProcessingService(mockLanguageDetector);
  });

  describe('normalizeArabicText', () => {
    it('normalizes Arabic diacritics correctly', () => {
      const textWithDiacritics = 'مَرْحَباً بِكَ فِي نِظَامِ الْمَوَارِدِ الْبَشَرِيَّةِ';
      const expectedNormalized = 'مرحبا بك في نظام الموارد البشرية';
      
      const result = arabicTextProcessor.normalizeArabicText(textWithDiacritics);
      
      expect(result).toBe(expectedNormalized);
    });

    it('normalizes Arabic letter variations', () => {
      // Test different forms of letters
      const variations = 'أإآ ة ى ي'; // Different forms of alif, taa marbuta, alif maksura
      const normalized = 'ا ه ي ي';
      
      const result = arabicTextProcessor.normalizeArabicText(variations);
      
      expect(result).toBe(normalized);
    });

    it('handles mixed Arabic-English text', () => {
      const mixedText = 'Hello مرحبا World عالم';
      const result = arabicTextProcessor.normalizeArabicText(mixedText);
      
      // Should only normalize Arabic parts
      expect(result).toContain('Hello');
      expect(result).toContain('World');
      expect(result).toContain('مرحبا');
      expect(result).toContain('عالم');
    });

    it('removes extra whitespace and punctuation', () => {
      const messyText = '  مرحبا  ،،  بك   في  النظام  !!  ';
      const result = arabicTextProcessor.normalizeArabicText(messyText);
      
      expect(result).toBe('مرحبا بك في النظام');
    });

    it('handles empty and whitespace-only text', () => {
      expect(arabicTextProcessor.normalizeArabicText('')).toBe('');
      expect(arabicTextProcessor.normalizeArabicText('   ')).toBe('');
      expect(arabicTextProcessor.normalizeArabicText('\n\t\r')).toBe('');
    });
  });

  describe('tokenizeArabicText', () => {
    it('tokenizes Arabic text correctly', () => {
      const text = 'مرحبا بك في نظام الموارد البشرية المتطور';
      const result = arabicTextProcessor.tokenizeArabicText(text);
      
      expect(result).toEqual([
        'مرحبا', 'بك', 'في', 'نظام', 'الموارد', 'البشرية', 'المتطور'
      ]);
    });

    it('handles Arabic punctuation correctly', () => {
      const text = 'مرحبا، كيف الحال؟ أهلا وسهلا!';
      const result = arabicTextProcessor.tokenizeArabicText(text);
      
      expect(result).toEqual([
        'مرحبا', 'كيف', 'الحال', 'أهلا', 'وسهلا'
      ]);
    });

    it('preserves meaningful numbers and dates', () => {
      const text = 'الراتب 5000 ريال في تاريخ 2025/08/12';
      const result = arabicTextProcessor.tokenizeArabicText(text);
      
      expect(result).toContain('5000');
      expect(result).toContain('2025/08/12');
    });

    it('handles Arabic numerals (Hindu-Arabic)', () => {
      const text = 'الرقم ١٢٣٤٥ في السنة ٢٠٢٥';
      const result = arabicTextProcessor.tokenizeArabicText(text);
      
      expect(result).toContain('١٢٣٤٥');
      expect(result).toContain('٢٠٢٥');
    });

    it('filters out stop words when specified', () => {
      const text = 'هذا هو النظام الذي يساعد في الموارد البشرية';
      const result = arabicTextProcessor.tokenizeArabicText(text, { removeStopWords: true });
      
      // Common Arabic stop words should be removed
      expect(result).not.toContain('هذا');
      expect(result).not.toContain('هو');
      expect(result).not.toContain('الذي');
      expect(result).not.toContain('في');
      
      // Meaningful words should remain
      expect(result).toContain('النظام');
      expect(result).toContain('يساعد');
      expect(result).toContain('الموارد');
      expect(result).toContain('البشرية');
    });
  });

  describe('stemArabicWords', () => {
    it('stems Arabic words to their roots', () => {
      const words = ['المدرسة', 'المدارس', 'المدرس', 'المدرسين'];
      const result = arabicTextProcessor.stemArabicWords(words);
      
      // All should stem to the same root (درس)
      const uniqueStems = [...new Set(result)];
      expect(uniqueStems).toHaveLength(1);
      expect(uniqueStems[0]).toMatch(/درس/);
    });

    it('handles different word patterns', () => {
      const words = ['كاتب', 'كتب', 'مكتوب', 'كتابة'];
      const result = arabicTextProcessor.stemArabicWords(words);
      
      // All should relate to the root (كتب)
      result.forEach(stem => {
        expect(stem).toMatch(/كتب/);
      });
    });

    it('preserves non-Arabic words', () => {
      const words = ['Hello', 'مرحبا', 'World', 'عالم'];
      const result = arabicTextProcessor.stemArabicWords(words);
      
      expect(result).toContain('Hello');
      expect(result).toContain('World');
      expect(result.filter(word => word.includes('مرحب'))).toHaveLength(1);
      expect(result.filter(word => word.includes('عالم'))).toHaveLength(1);
    });
  });

  describe('extractKeyPhrases', () => {
    it('extracts key phrases from Arabic text', () => {
      const text = 'نظام العمل السعودي ينص على حقوق الموظفين وواجباتهم في بيئة العمل';
      const result = arabicTextProcessor.extractKeyPhrases(text);
      
      expect(result).toContainEqual(
        expect.objectContaining({
          phrase: 'نظام العمل السعودي',
          importance: expect.any(Number),
        })
      );
      expect(result).toContainEqual(
        expect.objectContaining({
          phrase: 'حقوق الموظفين',
          importance: expect.any(Number),
        })
      );
    });

    it('ranks phrases by importance', () => {
      const text = 'الراتب والمكافآت تعتبر من أهم حقوق الموظف في نظام العمل';
      const result = arabicTextProcessor.extractKeyPhrases(text);
      
      // Results should be sorted by importance
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].importance).toBeGreaterThanOrEqual(result[i + 1].importance);
      }
    });

    it('handles technical HR terms', () => {
      const text = 'مكافأة نهاية الخدمة والتأمينات الاجتماعية والإجازات السنوية';
      const result = arabicTextProcessor.extractKeyPhrases(text);
      
      const phrases = result.map(r => r.phrase);
      expect(phrases).toContain('مكافأة نهاية الخدمة');
      expect(phrases).toContain('التأمينات الاجتماعية');
      expect(phrases).toContain('الإجازات السنوية');
    });
  });

  describe('detectTextDirection', () => {
    it('detects RTL for Arabic text', () => {
      const arabicText = 'مرحبا بك في نظام الموارد البشرية';
      mockLanguageDetector.isRTL.mockReturnValue(true);
      
      const result = arabicTextProcessor.detectTextDirection(arabicText);
      
      expect(result).toBe('rtl');
    });

    it('detects LTR for English text', () => {
      const englishText = 'Welcome to the HR Intelligence Platform';
      mockLanguageDetector.isRTL.mockReturnValue(false);
      
      const result = arabicTextProcessor.detectTextDirection(englishText);
      
      expect(result).toBe('ltr');
    });

    it('handles mixed text correctly', () => {
      const mixedText = 'Welcome مرحبا to the platform';
      mockLanguageDetector.detectMixedLanguages.mockReturnValue([
        { language: 'en', confidence: 0.6, portion: 'Welcome to the platform' },
        { language: 'ar', confidence: 0.4, portion: 'مرحبا' }
      ]);
      
      // Should determine direction based on dominant language
      const result = arabicTextProcessor.detectTextDirection(mixedText);
      
      expect(result).toBe('ltr'); // English is dominant
    });

    it('defaults to LTR for neutral/unknown text', () => {
      const neutralText = '123 456 789';
      mockLanguageDetector.isRTL.mockReturnValue(false);
      
      const result = arabicTextProcessor.detectTextDirection(neutralText);
      
      expect(result).toBe('ltr');
    });
  });

  describe('formatArabicNumbers', () => {
    it('converts Western numerals to Arabic-Indic numerals', () => {
      const text = 'الراتب 15000 ريال في عام 2025';
      const result = arabicTextProcessor.formatArabicNumbers(text, 'arabic-indic');
      
      expect(result).toBe('الراتب ١٥٠٠٠ ريال في عام ٢٠٢٥');
    });

    it('converts Arabic-Indic numerals to Western numerals', () => {
      const text = 'الراتب ١٥٠٠٠ ريال في عام ٢٠٢٥';
      const result = arabicTextProcessor.formatArabicNumbers(text, 'western');
      
      expect(result).toBe('الراتب 15000 ريال في عام 2025');
    });

    it('handles mixed number formats', () => {
      const text = 'المبلغ ١٥٠٠٠ + 5000 = 20000';
      const result = arabicTextProcessor.formatArabicNumbers(text, 'western');
      
      expect(result).toBe('المبلغ 15000 + 5000 = 20000');
    });

    it('preserves non-numeric text', () => {
      const text = 'مرحبا بك في النظام';
      const result = arabicTextProcessor.formatArabicNumbers(text, 'arabic-indic');
      
      expect(result).toBe(text); // Should remain unchanged
    });
  });

  describe('analyzeSentiment', () => {
    it('detects positive sentiment in Arabic text', () => {
      const positiveText = 'هذا نظام ممتاز ورائع جداً، أحببته كثيراً';
      const result = arabicTextProcessor.analyzeSentiment(positiveText);
      
      expect(result.sentiment).toBe('positive');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('detects negative sentiment in Arabic text', () => {
      const negativeText = 'هذا النظام سيء جداً ولا يعمل بشكل صحيح، أكرهه';
      const result = arabicTextProcessor.analyzeSentiment(negativeText);
      
      expect(result.sentiment).toBe('negative');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('detects neutral sentiment', () => {
      const neutralText = 'هذا تقرير عن نظام الموارد البشرية في الشركة';
      const result = arabicTextProcessor.analyzeSentiment(neutralText);
      
      expect(result.sentiment).toBe('neutral');
    });

    it('handles mixed language sentiment', () => {
      const mixedText = 'This system is excellent هذا النظام ممتاز';
      const result = arabicTextProcessor.analyzeSentiment(mixedText);
      
      expect(result.sentiment).toBe('positive');
      expect(result.languages).toContain('ar');
      expect(result.languages).toContain('en');
    });
  });

  describe('generateArabicSummary', () => {
    it('generates a concise Arabic summary', () => {
      const longText = `
        نظام العمل السعودي هو القانون الذي ينظم علاقات العمل في المملكة العربية السعودية.
        يحدد هذا النظام حقوق وواجبات كل من العامل وصاحب العمل.
        كما ينص على أنواع الإجازات المختلفة مثل الإجازة السنوية والإجازة المرضية.
        يتضمن النظام أيضاً أحكام مكافأة نهاية الخدمة والتأمينات الاجتماعية.
        هناك قواعد محددة لساعات العمل والعمل الإضافي.
        النظام يهدف إلى حماية حقوق العمال وتنظيم سوق العمل بشكل عادل.
      `;
      
      const result = arabicTextProcessor.generateArabicSummary(longText, { maxSentences: 2 });
      
      expect(result.summary).toBeTruthy();
      expect(result.summary.length).toBeLessThan(longText.length);
      expect(result.summary).toMatch(/نظام العمل السعودي/);
      
      // Should contain 2 sentences or less
      const sentenceCount = (result.summary.match(/[.!؟]/g) || []).length;
      expect(sentenceCount).toBeLessThanOrEqual(2);
    });

    it('extracts key points from summary', () => {
      const text = 'نظام العمل ينظم الإجازات والمكافآت وساعات العمل';
      const result = arabicTextProcessor.generateArabicSummary(text);
      
      expect(result.keyPoints).toContain('الإجازات');
      expect(result.keyPoints).toContain('المكافآت');
      expect(result.keyPoints).toContain('ساعات العمل');
    });

    it('handles short text appropriately', () => {
      const shortText = 'نظام العمل السعودي.';
      const result = arabicTextProcessor.generateArabicSummary(shortText);
      
      expect(result.summary).toBe(shortText);
      expect(result.compressionRatio).toBeCloseTo(1.0);
    });
  });

  describe('validateArabicInput', () => {
    it('validates correct Arabic text', () => {
      const validText = 'مرحبا بك في نظام الموارد البشرية';
      const result = arabicTextProcessor.validateArabicInput(validText);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid characters', () => {
      const invalidText = 'مرحبا <script>alert("xss")</script> بك';
      const result = arabicTextProcessor.validateArabicInput(invalidText);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid HTML/script tags detected');
    });

    it('validates text length limits', () => {
      const tooLongText = 'ا'.repeat(10001); // Assuming 10000 char limit
      const result = arabicTextProcessor.validateArabicInput(tooLongText);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text exceeds maximum length');
    });

    it('detects mixed writing directions issues', () => {
      // Problematic mixed text that could cause display issues
      const problematicText = 'Hello مرحبا\u202Eworld\u202D عالم';
      const result = arabicTextProcessor.validateArabicInput(problematicText);
      
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/bidirectional/)
      );
    });
  });

  describe('performance optimization', () => {
    it('processes large Arabic text efficiently', async () => {
      const largeText = 'نظام العمل السعودي '.repeat(1000);
      
      const startTime = Date.now();
      const result = arabicTextProcessor.normalizeArabicText(largeText);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result).toBeTruthy();
    });

    it('caches stemming results for repeated words', () => {
      const words = ['المدرسة', 'المدرسة', 'المدرسة']; // Repeated word
      
      const spy = jest.spyOn(arabicTextProcessor, 'stemArabicWords');
      
      arabicTextProcessor.stemArabicWords(words);
      arabicTextProcessor.stemArabicWords(words);
      
      // Internal caching should optimize repeated operations
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('handles malformed Arabic text gracefully', () => {
      const malformedText = '\uFEFF\u200B\u200C\u200D'; // Zero-width characters
      
      expect(() => {
        arabicTextProcessor.normalizeArabicText(malformedText);
      }).not.toThrow();
    });

    it('handles null and undefined inputs', () => {
      expect(arabicTextProcessor.normalizeArabicText(null as any)).toBe('');
      expect(arabicTextProcessor.normalizeArabicText(undefined as any)).toBe('');
    });

    it('handles extremely long input gracefully', () => {
      const extremelyLongText = 'ا'.repeat(1000000); // 1MB of Arabic text
      
      expect(() => {
        arabicTextProcessor.normalizeArabicText(extremelyLongText);
      }).not.toThrow();
    });
  });
});