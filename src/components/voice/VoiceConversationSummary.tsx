'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Share2, 
  Play, 
  Volume2,
  Clock,
  MessageSquare,
  Mic,
  Languages,
  TrendingUp,
  BarChart3,
  PieChart,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { VoiceMessage, VoiceAnalytics } from '@/types/voice';
import useTextToSpeech from '@/hooks/useTextToSpeech';

interface ConversationSummary {
  id: string;
  title: string;
  titleAr?: string;
  totalDuration: number;
  totalMessages: number;
  voiceMessages: number;
  textMessages: number;
  languages: Array<{
    language: 'ar' | 'en';
    percentage: number;
    duration: number;
  }>;
  keyTopics: Array<{
    topic: string;
    topicAr?: string;
    mentions: number;
    confidence: number;
  }>;
  summary: string;
  summaryAr?: string;
  actionItems?: Array<{
    item: string;
    itemAr?: string;
    priority: 'high' | 'medium' | 'low';
    completed?: boolean;
  }>;
  participants?: Array<{
    name: string;
    voiceTime: number;
    messages: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface VoiceConversationSummaryProps {
  conversationId: string;
  voiceMessages: VoiceMessage[];
  analytics?: VoiceAnalytics;
  language?: 'ar' | 'en';
  onExport?: (format: 'pdf' | 'docx' | 'txt') => void;
  onShare?: (summary: ConversationSummary) => void;
  className?: string;
}

export function VoiceConversationSummary({
  conversationId,
  voiceMessages,
  analytics,
  language = 'ar',
  onExport,
  onShare,
  className,
}: VoiceConversationSummaryProps) {
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isRTL = language === 'ar';

  // Text-to-speech for reading summary
  const { speak, isSpeaking, stop: stopSpeaking } = useTextToSpeech({
    settings: {
      language,
      rate: 1.0,
      pitch: 1.0,
      volume: 0.8,
      autoDetectLanguage: false,
      noiseReduction: false,
      echoCancellation: false,
      autoGainControl: false,
    }
  });

  // Generate conversation summary
  const generateSummary = useCallback(async () => {
    if (voiceMessages.length === 0) return;

    setIsGenerating(true);
    try {
      // Analyze voice messages
      const totalDuration = voiceMessages.reduce((sum, msg) => sum + msg.duration, 0);
      const languageStats = voiceMessages.reduce((stats, msg) => {
        stats[msg.language] = (stats[msg.language] || 0) + msg.duration;
        return stats;
      }, {} as Record<string, number>);

      const languages = Object.entries(languageStats).map(([lang, duration]) => ({
        language: lang as 'ar' | 'en',
        percentage: (duration / totalDuration) * 100,
        duration,
      }));

      // Extract key topics (simplified - in real implementation, use NLP)
      const allText = voiceMessages.map(msg => msg.transcript).join(' ');
      const keyTopics = extractKeyTopics(allText, language);

      // Generate summary using AI
      const generatedSummary = await generateAISummary(
        voiceMessages.map(msg => ({
          text: msg.transcript,
          language: msg.language,
          timestamp: msg.timestamp,
          confidence: msg.confidence || 0.8,
        })),
        language
      );

      const newSummary: ConversationSummary = {
        id: `summary_${conversationId}_${Date.now()}`,
        title: language === 'ar' ? 'ملخص المحادثة الصوتية' : 'Voice Conversation Summary',
        titleAr: 'ملخص المحادثة الصوتية',
        totalDuration,
        totalMessages: voiceMessages.length,
        voiceMessages: voiceMessages.length,
        textMessages: 0,
        languages,
        keyTopics,
        summary: generatedSummary.summary,
        summaryAr: generatedSummary.summaryAr,
        actionItems: generatedSummary.actionItems,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setSummary(newSummary);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [voiceMessages, conversationId, language]);

  // Extract key topics from text (simplified implementation)
  const extractKeyTopics = useCallback((text: string, lang: 'ar' | 'en') => {
    const hrKeywords = lang === 'ar' 
      ? ['راتب', 'إجازة', 'عمل', 'موظف', 'شركة', 'قانون', 'عقد', 'تدريب', 'ترقية', 'استقالة']
      : ['salary', 'leave', 'work', 'employee', 'company', 'law', 'contract', 'training', 'promotion', 'resignation'];
    
    const legalKeywords = lang === 'ar'
      ? ['نظام العمل', 'قانون', 'حقوق', 'واجبات', 'تعويض', 'فصل', 'إنهاء خدمة', 'مكافأة']
      : ['labor law', 'legal', 'rights', 'obligations', 'compensation', 'termination', 'severance', 'bonus'];

    const allKeywords = [...hrKeywords, ...legalKeywords];
    const wordFreq: Record<string, number> = {};

    // Count keyword occurrences
    allKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        wordFreq[keyword] = matches.length;
      }
    });

    // Sort by frequency and return top topics
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic, mentions]) => ({
        topic,
        topicAr: getArabicTopic(topic),
        mentions,
        confidence: Math.min(mentions / 10, 1), // Simple confidence based on mentions
      }));
  }, []);

  // Get Arabic translation for topic (simplified)
  const getArabicTopic = (topic: string): string => {
    const translations: Record<string, string> = {
      'salary': 'راتب',
      'leave': 'إجازة',
      'work': 'عمل',
      'employee': 'موظف',
      'company': 'شركة',
      'law': 'قانون',
      'contract': 'عقد',
      'training': 'تدريب',
      'promotion': 'ترقية',
      'resignation': 'استقالة',
      'labor law': 'نظام العمل',
      'legal': 'قانوني',
      'rights': 'حقوق',
      'obligations': 'واجبات',
      'compensation': 'تعويض',
      'termination': 'فصل',
      'severance': 'إنهاء خدمة',
      'bonus': 'مكافأة',
    };
    return translations[topic.toLowerCase()] || topic;
  };

  // Generate AI summary (mock implementation)
  const generateAISummary = async (
    messages: Array<{
      text: string;
      language: string;
      timestamp: number;
      confidence: number;
    }>,
    targetLanguage: 'ar' | 'en'
  ) => {
    // In a real implementation, this would call an AI service
    const allText = messages.map(msg => msg.text).join(' ');
    
    const summary = targetLanguage === 'ar'
      ? `تمت مناقشة عدة مواضيع متعلقة بالموارد البشرية والقوانين العملية. شملت المحادثة ${messages.length} رسالة صوتية بمدة إجمالية ${Math.round(voiceMessages.reduce((sum, msg) => sum + msg.duration, 0) / 60)} دقيقة.`
      : `Several topics related to human resources and labor laws were discussed. The conversation included ${messages.length} voice messages with a total duration of ${Math.round(voiceMessages.reduce((sum, msg) => sum + msg.duration, 0) / 60)} minutes.`;
    
    const summaryAr = `تمت مناقشة عدة مواضيع متعلقة بالموارد البشرية والقوانين العملية. شملت المحادثة ${messages.length} رسالة صوتية بمدة إجمالية ${Math.round(voiceMessages.reduce((sum, msg) => sum + msg.duration, 0) / 60)} دقيقة.`;
    
    // Extract potential action items (simplified)
    const actionItems = extractActionItems(allText, targetLanguage);
    
    return {
      summary,
      summaryAr,
      actionItems,
    };
  };

  // Extract action items from text
  const extractActionItems = (text: string, lang: 'ar' | 'en') => {
    const actionWords = lang === 'ar'
      ? ['يجب', 'ينبغي', 'سوف', 'سأقوم', 'نحتاج', 'مطلوب']
      : ['should', 'must', 'need to', 'will', 'required', 'action'];
    
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
    const actionItems: Array<{
      item: string;
      itemAr?: string;
      priority: 'high' | 'medium' | 'low';
      completed?: boolean;
    }> = [];
    
    sentences.forEach(sentence => {
      const hasActionWord = actionWords.some(word => 
        sentence.toLowerCase().includes(word.toLowerCase())
      );
      
      if (hasActionWord && sentence.trim().length > 20) {
        actionItems.push({
          item: sentence.trim(),
          itemAr: lang === 'en' ? undefined : sentence.trim(),
          priority: 'medium', // Default priority
          completed: false,
        });
      }
    });
    
    return actionItems.slice(0, 5); // Limit to 5 action items
  };

  // Format duration
  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle reading summary
  const handleReadSummary = useCallback(() => {
    if (!summary) return;
    
    if (isSpeaking) {
      stopSpeaking();
    } else {
      const textToRead = language === 'ar' && summary.summaryAr 
        ? summary.summaryAr 
        : summary.summary;
      speak(textToRead, { language });
    }
  }, [summary, language, isSpeaking, speak, stopSpeaking]);

  // Auto-generate summary when voice messages are available
  useEffect(() => {
    if (voiceMessages.length > 0 && !summary && !isGenerating) {
      generateSummary();
    }
  }, [voiceMessages.length, summary, isGenerating, generateSummary]);

  if (voiceMessages.length === 0) {
    return (
      <div className={cn(
        "p-6 text-center text-gray-500",
        isRTL && "font-arabic"
      )}>
        <Mic className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>
          {isRTL 
            ? 'لا توجد رسائل صوتية لتلخيصها'
            : 'No voice messages to summarize'
          }
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className, isRTL && "text-right")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={cn(
          "text-lg font-semibold flex items-center gap-2",
          isRTL && "font-arabic"
        )}>
          <FileText className="w-5 h-5" />
          {isRTL ? 'ملخص المحادثة الصوتية' : 'Voice Conversation Summary'}
        </h3>
        
        <div className="flex items-center gap-2">
          {summary && (
            <>
              <Button
                onClick={handleReadSummary}
                variant="outline"
                size="sm"
                className={cn(isSpeaking && "bg-saudi-navy-50 text-saudi-navy-700")}
              >
                <Volume2 className="w-4 h-4 mr-1" />
                {isSpeaking 
                  ? (isRTL ? 'إيقاف' : 'Stop')
                  : (isRTL ? 'استماع' : 'Listen')
                }
              </Button>

              {onShare && (
                <Button
                  onClick={() => onShare(summary)}
                  variant="outline"
                  size="sm"
                >
                  <Share2 className="w-4 h-4 mr-1" />
                  {isRTL ? 'مشاركة' : 'Share'}
                </Button>
              )}

              {onExport && (
                <Button
                  onClick={() => onExport('pdf')}
                  variant="outline"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-1" />
                  {isRTL ? 'تصدير' : 'Export'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isGenerating && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-saudi-navy-200 border-t-saudi-navy-600 rounded-full mx-auto mb-3"></div>
            <p className={cn("text-sm text-gray-600", isRTL && "font-arabic")}>
              {isRTL ? 'جار إنشاء الملخص...' : 'Generating summary...'}
            </p>
          </div>
        </div>
      )}

      {/* Summary content */}
      {summary && (
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <Clock className="w-5 h-5 mx-auto mb-1 text-saudi-navy-600" />
              <div className="font-semibold">{formatDuration(summary.totalDuration)}</div>
              <div className={cn("text-xs text-gray-600", isRTL && "font-arabic")}>
                {isRTL ? 'المدة الإجمالية' : 'Total Duration'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <MessageSquare className="w-5 h-5 mx-auto mb-1 text-saudi-navy-600" />
              <div className="font-semibold">{summary.voiceMessages}</div>
              <div className={cn("text-xs text-gray-600", isRTL && "font-arabic")}>
                {isRTL ? 'رسائل صوتية' : 'Voice Messages'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <Languages className="w-5 h-5 mx-auto mb-1 text-saudi-navy-600" />
              <div className="font-semibold">{summary.languages.length}</div>
              <div className={cn("text-xs text-gray-600", isRTL && "font-arabic")}>
                {isRTL ? 'لغات' : 'Languages'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-saudi-navy-600" />
              <div className="font-semibold">{summary.keyTopics.length}</div>
              <div className={cn("text-xs text-gray-600", isRTL && "font-arabic")}>
                {isRTL ? 'مواضيع رئيسية' : 'Key Topics'}
              </div>
            </div>
          </div>

          {/* Language distribution */}
          {summary.languages.length > 1 && (
            <div className="bg-white border rounded-lg p-4">
              <h4 className={cn("font-medium mb-3 flex items-center gap-2", isRTL && "font-arabic")}>
                <PieChart className="w-4 h-4" />
                {isRTL ? 'توزيع اللغات' : 'Language Distribution'}
              </h4>
              <div className="space-y-2">
                {summary.languages.map((lang, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {lang.language.toUpperCase()}
                      </Badge>
                      <span className="text-sm">
                        {lang.language === 'ar' ? 'العربية' : 'English'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {lang.percentage.toFixed(1)}% ({formatDuration(lang.duration)})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key topics */}
          {summary.keyTopics.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h4 className={cn("font-medium mb-3 flex items-center gap-2", isRTL && "font-arabic")}>
                <BarChart3 className="w-4 h-4" />
                {isRTL ? 'المواضيع الرئيسية' : 'Key Topics'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {summary.keyTopics.map((topic, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {isRTL && topic.topicAr ? topic.topicAr : topic.topic}
                    <span className="ml-1 opacity-60">({topic.mentions})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Summary text */}
          <div className="bg-white border rounded-lg p-4">
            <h4 className={cn("font-medium mb-3", isRTL && "font-arabic")}>
              {isRTL ? 'الملخص' : 'Summary'}
            </h4>
            <p className={cn("text-gray-700 leading-relaxed", isRTL && "font-arabic")}>
              {isRTL && summary.summaryAr ? summary.summaryAr : summary.summary}
            </p>
          </div>

          {/* Action items */}
          {summary.actionItems && summary.actionItems.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h4 className={cn("font-medium mb-3", isRTL && "font-arabic")}>
                {isRTL ? 'عناصر العمل' : 'Action Items'}
              </h4>
              <div className="space-y-2">
                {summary.actionItems.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Badge 
                      variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}
                      className="text-xs mt-1"
                    >
                      {item.priority}
                    </Badge>
                    <p className={cn("text-sm flex-1", isRTL && "font-arabic")}>
                      {isRTL && item.itemAr ? item.itemAr : item.item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-500 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className={cn(isRTL && "font-arabic")}>
                {isRTL ? 'تم الإنشاء:' : 'Generated:'} {summary.createdAt.toLocaleString()}
              </span>
              <span className={cn(isRTL && "font-arabic")}>
                {isRTL ? 'المحادثة:' : 'Conversation:'} {conversationId.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceConversationSummary;