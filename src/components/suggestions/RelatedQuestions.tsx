'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, MessageCircle, TrendingUp, Clock, Star, ThumbsUp, ThumbsDown } from 'lucide-react';
import { RelatedQuestion, ConversationMessage, SuggestionCategory } from '@/types/suggestions';
import { cn } from '@/libs/utils';

interface RelatedQuestionsProps {
  currentQuery: string;
  conversationHistory?: ConversationMessage[];
  maxSuggestions?: number;
  includeFollowup?: boolean;
  language?: 'ar' | 'en' | 'both';
  onQuestionSelect?: (question: string) => void;
  onFeedback?: (questionText: string, feedback: 'helpful' | 'not_helpful', rating?: number) => void;
  className?: string;
  showContext?: boolean;
  autoRefresh?: boolean;
}

interface RelatedQuestionItemProps {
  question: RelatedQuestion;
  language: 'ar' | 'en' | 'both';
  onSelect: (question: RelatedQuestion) => void;
  onFeedback?: (feedback: 'helpful' | 'not_helpful', rating?: number) => void;
  showComplexity?: boolean;
}

const CategoryIcons: Record<SuggestionCategory, React.ElementType> = {
  labor_law: MessageCircle,
  employment: MessageCircle,
  compensation: TrendingUp,
  benefits: Star,
  disciplinary: MessageCircle,
  termination: MessageCircle,
  compliance: MessageCircle,
  contracts: MessageCircle,
  policies: MessageCircle,
  training: MessageCircle,
  performance: TrendingUp,
  leaves: Clock,
  recruitment: MessageCircle,
  general: MessageCircle
};

const ComplexityColors = {
  simple: 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400',
  medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400',
  complex: 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400'
};

const RelatedQuestionItem: React.FC<RelatedQuestionItemProps> = ({
  question,
  language,
  onSelect,
  onFeedback,
  showComplexity = true
}) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [userFeedback, setUserFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  
  const Icon = CategoryIcons[question.category] || MessageCircle;
  const displayText = language === 'ar' ? question.textArabic : question.text;
  const isRTL = language === 'ar';

  const handleQuestionClick = () => {
    onSelect(question);
  };

  const handleFeedback = (feedback: 'helpful' | 'not_helpful', rating?: number) => {
    setUserFeedback(feedback);
    setShowFeedback(false);
    if (onFeedback) {
      onFeedback(feedback, rating);
    }
  };

  const getComplexityLabel = (complexity: string) => {
    switch (complexity) {
      case 'simple':
        return language === 'ar' ? 'بسيط' : 'Simple';
      case 'medium':
        return language === 'ar' ? 'متوسط' : 'Medium';
      case 'complex':
        return language === 'ar' ? 'معقد' : 'Complex';
      default:
        return language === 'ar' ? 'متوسط' : 'Medium';
    }
  };

  const getCategoryLabel = (category: SuggestionCategory) => {
    const labels = {
      ar: {
        labor_law: 'قانون العمل',
        employment: 'التوظيف',
        compensation: 'التعويضات',
        benefits: 'المزايا',
        disciplinary: 'التأديب',
        termination: 'إنهاء الخدمة',
        compliance: 'الامتثال',
        contracts: 'العقود',
        policies: 'السياسات',
        training: 'التدريب',
        performance: 'الأداء',
        leaves: 'الإجازات',
        recruitment: 'التوظيف',
        general: 'عام'
      },
      en: {
        labor_law: 'Labor Law',
        employment: 'Employment',
        compensation: 'Compensation',
        benefits: 'Benefits',
        disciplinary: 'Disciplinary',
        termination: 'Termination',
        compliance: 'Compliance',
        contracts: 'Contracts',
        policies: 'Policies',
        training: 'Training',
        performance: 'Performance',
        leaves: 'Leaves',
        recruitment: 'Recruitment',
        general: 'General'
      }
    };
    
    return language === 'ar' ? labels.ar[category] : labels.en[category];
  };

  return (
    <div 
      className={cn(
        "group relative border border-gray-200 dark:border-gray-700 rounded-lg p-4",
        "hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer",
        "bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/10"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start gap-3" onClick={handleQuestionClick}>
        <div className="flex-shrink-0 mt-1">
          <Icon 
            size={16} 
            className="text-gray-400 group-hover:text-blue-500 transition-colors" 
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
            {displayText}
          </h4>
          
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
              {getCategoryLabel(question.category)}
            </span>
            
            {showComplexity && (
              <span className={cn(
                "px-2 py-1 rounded-full font-medium",
                ComplexityColors[question.estimatedComplexity]
              )}>
                {getComplexityLabel(question.estimatedComplexity)}
              </span>
            )}
            
            {question.isFollowup && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full">
                {language === 'ar' ? 'متابعة' : 'Follow-up'}
              </span>
            )}
            
            <div className="flex items-center gap-1">
              <Star size={12} className="text-yellow-500" />
              <span>{(question.relevanceScore * 100).toFixed(0)}%</span>
            </div>
          </div>
          
          {question.relatedEntities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {question.relatedEntities.slice(0, 3).map((entity, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                >
                  {entity}
                </span>
              ))}
              {question.relatedEntities.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{question.relatedEntities.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex-shrink-0">
          <ChevronRight 
            size={16} 
            className="text-gray-400 group-hover:text-blue-500 transition-colors" 
          />
        </div>
      </div>
      
      {/* Feedback Section */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        {!userFeedback ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {language === 'ar' ? 'هل كان هذا مفيداً؟' : 'Was this helpful?'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFeedback('helpful');
                }}
                className="p-1 text-gray-400 hover:text-green-500 transition-colors"
                title={language === 'ar' ? 'مفيد' : 'Helpful'}
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFeedback('not_helpful');
                }}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title={language === 'ar' ? 'غير مفيد' : 'Not helpful'}
              >
                <ThumbsDown size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {userFeedback === 'helpful' 
              ? (language === 'ar' ? 'شكراً لك!' : 'Thank you!')
              : (language === 'ar' ? 'شكراً على تعليقك' : 'Thanks for your feedback')
            }
          </div>
        )}
      </div>
    </div>
  );
};

export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
  currentQuery,
  conversationHistory = [],
  maxSuggestions = 6,
  includeFollowup = true,
  language = 'both',
  onQuestionSelect,
  onFeedback,
  className,
  showContext = true,
  autoRefresh = false
}) => {
  const [questions, setQuestions] = useState<RelatedQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<any>(null);

  const fetchRelatedQuestions = async () => {
    if (!currentQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/suggestions/related', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentQuery,
          conversationHistory,
          maxSuggestions,
          includeFollowup
        })
      });

      const result = await response.json();

      if (result.success) {
        setQuestions(result.data.questions);
        setContext(result.data.context);
      } else {
        setError(result.error?.message || 'Failed to fetch related questions');
      }
    } catch (err) {
      console.error('Related questions error:', err);
      setError('Failed to fetch related questions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentQuery.trim()) {
      fetchRelatedQuestions();
    } else {
      setQuestions([]);
      setContext(null);
    }
  }, [currentQuery, conversationHistory, maxSuggestions, includeFollowup]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && currentQuery.trim()) {
      const interval = setInterval(fetchRelatedQuestions, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, currentQuery]);

  const handleQuestionSelect = (question: RelatedQuestion) => {
    const questionText = language === 'ar' ? question.textArabic : question.text;
    if (onQuestionSelect) {
      onQuestionSelect(questionText);
    }
  };

  const handleQuestionFeedback = (questionText: string, feedback: 'helpful' | 'not_helpful', rating?: number) => {
    if (onFeedback) {
      onFeedback(questionText, feedback, rating);
    }

    // Also send feedback to API
    fetch('/api/v1/suggestions/related', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        selectedQuestion: questionText,
        feedback,
        rating
      })
    }).catch(err => console.error('Failed to send feedback:', err));
  };

  if (!currentQuery.trim()) {
    return (
      <div className={cn("text-center py-8 text-gray-500 dark:text-gray-400", className)}>
        <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">
          {language === 'ar' ? 'اسأل سؤالاً للحصول على أسئلة مرتبطة' : 'Ask a question to see related suggestions'}
        </p>
        <p className="text-sm">
          {language === 'ar' 
            ? 'سنقترح عليك أسئلة مرتبطة وأسئلة متابعة بناءً على استعلامك'
            : 'We\'ll suggest related questions and follow-ups based on your query'
          }
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {language === 'ar' ? 'جاري إنشاء الأسئلة المرتبطة...' : 'Generating related questions...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-center py-8 text-red-500", className)}>
        <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchRelatedQuestions}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {language === 'ar' ? 'حاول مرة أخرى' : 'Try again'}
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className={cn("text-center py-8 text-gray-500 dark:text-gray-400", className)}>
        <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">
          {language === 'ar' ? 'لا توجد أسئلة مرتبطة' : 'No related questions found'}
        </p>
        <p className="text-sm">
          {language === 'ar' 
            ? 'جرب تحسين استعلامك أو طرح سؤال مختلف'
            : 'Try refining your query or asking a different question'
          }
        </p>
      </div>
    );
  }

  const followupQuestions = questions.filter(q => q.isFollowup);
  const relatedQuestions = questions.filter(q => !q.isFollowup);

  return (
    <div className={cn("space-y-6", className)}>
      {showContext && context && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {language === 'ar' ? 'السياق' : 'Context'}
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">
                {language === 'ar' ? 'الموضوع الرئيسي:' : 'Main Topic:'}
              </span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {language === 'ar' ? context.mainTopicArabic : context.mainTopic}
              </span>
            </div>
            {context.relatedTopics.length > 0 && (
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  {language === 'ar' ? 'المواضيع المرتبطة:' : 'Related Topics:'}
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {context.relatedTopics.map((topic: string, index: number) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {relatedQuestions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageCircle size={20} />
            {language === 'ar' ? 'أسئلة مرتبطة' : 'Related Questions'}
            <span className="text-sm font-normal text-gray-500">({relatedQuestions.length})</span>
          </h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            {relatedQuestions.map((question, index) => (
              <RelatedQuestionItem
                key={index}
                question={question}
                language={language}
                onSelect={handleQuestionSelect}
                onFeedback={(feedback, rating) => handleQuestionFeedback(
                  language === 'ar' ? question.textArabic : question.text,
                  feedback,
                  rating
                )}
              />
            ))}
          </div>
        </div>
      )}

      {followupQuestions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ChevronRight size={20} />
            {language === 'ar' ? 'أسئلة متابعة' : 'Follow-up Questions'}
            <span className="text-sm font-normal text-gray-500">({followupQuestions.length})</span>
          </h3>
          
          <div className="space-y-3">
            {followupQuestions.map((question, index) => (
              <RelatedQuestionItem
                key={index}
                question={question}
                language={language}
                onSelect={handleQuestionSelect}
                onFeedback={(feedback, rating) => handleQuestionFeedback(
                  language === 'ar' ? question.textArabic : question.text,
                  feedback,
                  rating
                )}
                showComplexity={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};