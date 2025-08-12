'use client';

import {
  VoiceCommand,
  ArabicVoiceCommand,
  EnglishVoiceCommand,
  VOICE_COMMANDS_AR,
  VOICE_COMMANDS_EN,
} from '@/types/voice';

export interface CommandContext {
  currentDocument?: string;
  currentConversation?: string;
  searchQuery?: string;
  selectedText?: string;
  language?: 'ar' | 'en';
}

export interface CommandResult {
  recognized: boolean;
  command?: VoiceCommand;
  parameters?: string[];
  confidence: number;
  suggestion?: string;
  suggestionAr?: string;
}

export class VoiceCommandService {
  private commands: VoiceCommand[] = [];
  private context: CommandContext = {};

  constructor() {
    this.initializeCommands();
  }

  private initializeCommands(): void {
    this.commands = [
      // Search commands
      {
        command: 'search',
        commandAr: 'ابحث',
        pattern: /^(?:search for|find|look for)\s+(.+)/i,
        patternAr: /^(?:ابحث عن|ابحث|اعثر على|ابحث في)\s+(.+)/i,
        action: this.handleSearch.bind(this),
        description: 'Search for documents or information',
        descriptionAr: 'البحث عن المستندات أو المعلومات',
        examples: ['search for employment contracts', 'find salary information'],
        examplesAr: ['ابحث عن عقود العمل', 'ابحث عن معلومات الراتب'],
      },

      // Document commands
      {
        command: 'read_document',
        commandAr: 'اقرأ_الوثيقة',
        pattern: /^(?:read|open|show)\s+(?:document|doc|file)\s*(.+)?/i,
        patternAr: /^(?:اقرأ|افتح|اعرض)\s+(?:الوثيقة|المستند|الملف)\s*(.+)?/i,
        action: this.handleReadDocument.bind(this),
        description: 'Read or open a document',
        descriptionAr: 'قراءة أو فتح وثيقة',
        examples: ['read document about leave policy', 'open employee handbook'],
        examplesAr: ['اقرأ الوثيقة عن سياسة الإجازات', 'افتح دليل الموظف'],
      },

      // Conversation commands
      {
        command: 'open_conversation',
        commandAr: 'افتح_المحادثة',
        pattern: /^(?:open|show|go to)\s+(?:conversation|chat)\s*(.+)?/i,
        patternAr: /^(?:افتح|اعرض|اذهب إلى)\s+(?:المحادثة|الدردشة)\s*(.+)?/i,
        action: this.handleOpenConversation.bind(this),
        description: 'Open a conversation or chat',
        descriptionAr: 'فتح محادثة أو دردشة',
        examples: ['open conversation with HR', 'show recent chat'],
        examplesAr: ['افتح المحادثة مع الموارد البشرية', 'اعرض الدردشة الأخيرة'],
      },

      // Recording control commands
      {
        command: 'start_recording',
        commandAr: 'ابدأ_التسجيل',
        pattern: /^(?:start|begin)\s+(?:recording|voice note)/i,
        patternAr: /^(?:ابدأ|ابدأ في)\s+(?:التسجيل|التسجيل الصوتي)/i,
        action: this.handleStartRecording.bind(this),
        description: 'Start voice recording',
        descriptionAr: 'بدء التسجيل الصوتي',
        examples: ['start recording', 'begin voice note'],
        examplesAr: ['ابدأ التسجيل', 'ابدأ التسجيل الصوتي'],
      },

      {
        command: 'stop_recording',
        commandAr: 'أوقف_التسجيل',
        pattern: /^(?:stop|end|finish)\s+(?:recording|voice note)/i,
        patternAr: /^(?:أوقف|أنهِ|اكمل)\s+(?:التسجيل|التسجيل الصوتي)/i,
        action: this.handleStopRecording.bind(this),
        description: 'Stop voice recording',
        descriptionAr: 'إيقاف التسجيل الصوتي',
        examples: ['stop recording', 'end voice note'],
        examplesAr: ['أوقف التسجيل', 'أنهِ التسجيل الصوتي'],
      },

      // Playback commands
      {
        command: 'repeat',
        commandAr: 'كرر',
        pattern: /^(?:repeat|say again|replay)/i,
        patternAr: /^(?:كرر|قل مرة أخرى|أعد|أعد التشغيل)/i,
        action: this.handleRepeat.bind(this),
        description: 'Repeat the last message',
        descriptionAr: 'تكرار الرسالة الأخيرة',
        examples: ['repeat', 'say again'],
        examplesAr: ['كرر', 'قل مرة أخرى'],
      },

      {
        command: 'pause',
        commandAr: 'توقف',
        pattern: /^(?:pause|wait|hold on)/i,
        patternAr: /^(?:توقف|انتظر|اصبر)/i,
        action: this.handlePause.bind(this),
        description: 'Pause current operation',
        descriptionAr: 'إيقاف العملية الحالية مؤقتاً',
        examples: ['pause', 'wait', 'hold on'],
        examplesAr: ['توقف', 'انتظر', 'اصبر'],
      },

      {
        command: 'continue',
        commandAr: 'استكمل',
        pattern: /^(?:continue|resume|go on)/i,
        patternAr: /^(?:استكمل|تابع|أكمل)/i,
        action: this.handleContinue.bind(this),
        description: 'Continue or resume operation',
        descriptionAr: 'استكمال أو متابعة العملية',
        examples: ['continue', 'resume', 'go on'],
        examplesAr: ['استكمل', 'تابع', 'أكمل'],
      },

      // File operations
      {
        command: 'save',
        commandAr: 'احفظ',
        pattern: /^(?:save|export|download)\s*(?:this|current)?\s*(?:document|file|conversation)?\s*(.+)?/i,
        patternAr: /^(?:احفظ|صدر|حمل)\s*(?:هذا|الحالي)?\s*(?:المستند|الملف|المحادثة)?\s*(.+)?/i,
        action: this.handleSave.bind(this),
        description: 'Save or export current content',
        descriptionAr: 'حفظ أو تصدير المحتوى الحالي',
        examples: ['save document', 'export conversation', 'download file'],
        examplesAr: ['احفظ المستند', 'صدر المحادثة', 'حمل الملف'],
      },

      {
        command: 'share',
        commandAr: 'شارك',
        pattern: /^(?:share|send)\s*(?:this|current)?\s*(?:document|file|conversation)?\s*(?:with)?\s*(.+)?/i,
        patternAr: /^(?:شارك|أرسل)\s*(?:هذا|الحالي)?\s*(?:المستند|الملف|المحادثة)?\s*(?:مع)?\s*(.+)?/i,
        action: this.handleShare.bind(this),
        description: 'Share current content',
        descriptionAr: 'مشاركة المحتوى الحالي',
        examples: ['share document', 'send file', 'share with team'],
        examplesAr: ['شارك المستند', 'أرسل الملف', 'شارك مع الفريق'],
      },

      {
        command: 'print',
        commandAr: 'اطبع',
        pattern: /^(?:print|make a copy of)\s*(?:this|current)?\s*(?:document|file|page)?/i,
        patternAr: /^(?:اطبع|اطبع نسخة من)\s*(?:هذا|الحالي)?\s*(?:المستند|الملف|الصفحة)?/i,
        action: this.handlePrint.bind(this),
        description: 'Print current content',
        descriptionAr: 'طباعة المحتوى الحالي',
        examples: ['print document', 'make a copy of this page'],
        examplesAr: ['اطبع المستند', 'اطبع نسخة من هذه الصفحة'],
      },

      // Translation commands
      {
        command: 'translate_to_english',
        commandAr: 'ترجم_للإنجليزية',
        pattern: /^(?:translate to english|translate this to english)/i,
        patternAr: /^(?:ترجم إلى الإنجليزية|ترجم هذا إلى الإنجليزية|ترجم للإنجليزية)/i,
        action: this.handleTranslateToEnglish.bind(this),
        description: 'Translate content to English',
        descriptionAr: 'ترجمة المحتوى إلى الإنجليزية',
        examples: ['translate to english', 'translate this to english'],
        examplesAr: ['ترجم إلى الإنجليزية', 'ترجم هذا إلى الإنجليزية'],
      },

      {
        command: 'translate_to_arabic',
        commandAr: 'ترجم_للعربية',
        pattern: /^(?:translate to arabic|translate this to arabic)/i,
        patternAr: /^(?:ترجم إلى العربية|ترجم هذا إلى العربية|ترجم للعربية)/i,
        action: this.handleTranslateToArabic.bind(this),
        description: 'Translate content to Arabic',
        descriptionAr: 'ترجمة المحتوى إلى العربية',
        examples: ['translate to arabic', 'translate this to arabic'],
        examplesAr: ['ترجم إلى العربية', 'ترجم هذا إلى العربية'],
      },

      // Help and navigation
      {
        command: 'help',
        commandAr: 'مساعدة',
        pattern: /^(?:help|what can you do|show commands)/i,
        patternAr: /^(?:مساعدة|ماذا يمكنك أن تفعل|اعرض الأوامر|كيف أستطيع)/i,
        action: this.handleHelp.bind(this),
        description: 'Show available voice commands',
        descriptionAr: 'عرض الأوامر الصوتية المتاحة',
        examples: ['help', 'what can you do', 'show commands'],
        examplesAr: ['مساعدة', 'ماذا يمكنك أن تفعل', 'اعرض الأوامر'],
      },
    ];
  }

  public setContext(context: Partial<CommandContext>): void {
    this.context = { ...this.context, ...context };
  }

  public recognizeCommand(transcript: string, language: 'ar' | 'en' = 'ar'): CommandResult {
    const cleanTranscript = this.preprocessTranscript(transcript, language);
    
    // Try to match against all commands
    for (const command of this.commands) {
      const pattern = language === 'ar' && command.patternAr ? command.patternAr : command.pattern;
      const match = cleanTranscript.match(pattern);
      
      if (match) {
        const parameters = match.slice(1).filter(param => param && param.trim().length > 0);
        
        return {
          recognized: true,
          command,
          parameters,
          confidence: this.calculateConfidence(match, cleanTranscript),
        };
      }
    }

    // Try fuzzy matching for partial commands
    const suggestion = this.findSimilarCommand(cleanTranscript, language);
    
    return {
      recognized: false,
      confidence: 0,
      suggestion: suggestion?.description,
      suggestionAr: suggestion?.descriptionAr,
    };
  }

  private preprocessTranscript(transcript: string, language: 'ar' | 'en'): string {
    let cleaned = transcript.toLowerCase().trim();
    
    // Remove common filler words based on language
    if (language === 'ar') {
      const fillers = ['يعني', 'أه', 'أم', 'إيه', 'طيب', 'يلا', 'أيوة', 'نعم'];
      fillers.forEach(filler => {
        const regex = new RegExp(`\\b${filler}\\b`, 'g');
        cleaned = cleaned.replace(regex, '');
      });
    } else {
      const fillers = ['um', 'uh', 'er', 'ah', 'well', 'you know', 'like', 'okay'];
      fillers.forEach(filler => {
        const regex = new RegExp(`\\b${filler}\\b`, 'g');
        cleaned = cleaned.replace(regex, '');
      });
    }
    
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  private calculateConfidence(match: RegExpMatchArray, transcript: string): number {
    const matchedLength = match[0].length;
    const totalLength = transcript.length;
    
    // Base confidence on how much of the transcript matched
    let confidence = matchedLength / totalLength;
    
    // Boost confidence for exact command matches
    if (matchedLength === totalLength) {
      confidence = Math.min(1.0, confidence + 0.2);
    }
    
    // Reduce confidence for very short matches
    if (matchedLength < 3) {
      confidence *= 0.5;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  private findSimilarCommand(transcript: string, language: 'ar' | 'en'): VoiceCommand | null {
    let bestMatch: VoiceCommand | null = null;
    let bestScore = 0;
    
    for (const command of this.commands) {
      const commandText = language === 'ar' && command.commandAr ? command.commandAr : command.command;
      const score = this.calculateSimilarity(transcript, commandText);
      
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = command;
      }
    }
    
    return bestMatch;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Command handlers
  private handleSearch(parameters: string[]): void {
    const query = parameters.join(' ');
    const event = new CustomEvent('voice-command', {
      detail: { action: 'search', query }
    });
    window.dispatchEvent(event);
  }

  private handleReadDocument(parameters: string[]): void {
    const documentName = parameters.join(' ') || this.context.currentDocument;
    const event = new CustomEvent('voice-command', {
      detail: { action: 'read_document', documentName }
    });
    window.dispatchEvent(event);
  }

  private handleOpenConversation(parameters: string[]): void {
    const conversationId = parameters.join(' ') || this.context.currentConversation;
    const event = new CustomEvent('voice-command', {
      detail: { action: 'open_conversation', conversationId }
    });
    window.dispatchEvent(event);
  }

  private handleStartRecording(): void {
    const event = new CustomEvent('voice-command', {
      detail: { action: 'start_recording' }
    });
    window.dispatchEvent(event);
  }

  private handleStopRecording(): void {
    const event = new CustomEvent('voice-command', {
      detail: { action: 'stop_recording' }
    });
    window.dispatchEvent(event);
  }

  private handleRepeat(): void {
    const event = new CustomEvent('voice-command', {
      detail: { action: 'repeat' }
    });
    window.dispatchEvent(event);
  }

  private handlePause(): void {
    const event = new CustomEvent('voice-command', {
      detail: { action: 'pause' }
    });
    window.dispatchEvent(event);
  }

  private handleContinue(): void {
    const event = new CustomEvent('voice-command', {
      detail: { action: 'continue' }
    });
    window.dispatchEvent(event);
  }

  private handleSave(parameters: string[]): void {
    const filename = parameters.join(' ');
    const event = new CustomEvent('voice-command', {
      detail: { action: 'save', filename }
    });
    window.dispatchEvent(event);
  }

  private handleShare(parameters: string[]): void {
    const recipient = parameters.join(' ');
    const event = new CustomEvent('voice-command', {
      detail: { action: 'share', recipient }
    });
    window.dispatchEvent(event);
  }

  private handlePrint(): void {
    const event = new CustomEvent('voice-command', {
      detail: { action: 'print' }
    });
    window.dispatchEvent(event);
  }

  private handleTranslateToEnglish(): void {
    const event = new CustomEvent('voice-command', {
      detail: { action: 'translate', targetLanguage: 'en' }
    });
    window.dispatchEvent(event);
  }

  private handleTranslateToArabic(): void {
    const event = new CustomEvent('voice-command', {
      detail: { action: 'translate', targetLanguage: 'ar' }
    });
    window.dispatchEvent(event);
  }

  private handleHelp(): void {
    const event = new CustomEvent('voice-command', {
      detail: { action: 'help', commands: this.getCommandSummary() }
    });
    window.dispatchEvent(event);
  }

  public getCommandSummary(): Array<{command: string; description: string; descriptionAr: string}> {
    return this.commands.map(cmd => ({
      command: cmd.command,
      description: cmd.description,
      descriptionAr: cmd.descriptionAr,
    }));
  }

  public getCommands(): VoiceCommand[] {
    return [...this.commands];
  }

  public addCustomCommand(command: VoiceCommand): void {
    this.commands.push(command);
  }

  public removeCommand(commandName: string): void {
    this.commands = this.commands.filter(cmd => cmd.command !== commandName);
  }
}

// Singleton instance
export const voiceCommandService = new VoiceCommandService();
export default voiceCommandService;