'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle, AlertTriangle, Info, Lightbulb, 
  ArrowRight, Copy, ThumbsUp, ThumbsDown, RefreshCw 
} from 'lucide-react';
import { 
  QueryRefinement, 
  QueryAnalysis, 
  RefinementRecommendation, 
  RefinementType 
} from '@/types/suggestions';
import { cn } from '@/libs/utils';

interface QueryRefinementProps {
  originalQuery: string;
  language?: 'ar' | 'en' | 'both';
  includeTranslation?: boolean;
  onRefinementSelect?: (refinedQuery: string) => void;
  onApplyRefinement?: (refinedQuery: string, improvementType: RefinementType) => void;
  className?: string;
  showAnalysis?: boolean;
  showRecommendations?: boolean;
  autoRefresh?: boolean;
}

interface RefinementItemProps {
  refinement: QueryRefinement;
  language: 'ar' | 'en' | 'both';
  onSelect: (refinement: QueryRefinement) => void;
  onCopy: (text: string) => void;
  onFeedback: (helpful: boolean) => void;
}

interface AnalysisScoreProps {
  label: string;
  labelArabic: string;
  score: number;
  maxScore: number;
  language: 'ar' | 'en' | 'both';
  icon?: React.ElementType;
}

const RefinementTypeColors: Record<RefinementType, string> = {
  clarity: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400',
  specificity: 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400',
  completeness: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400',
  context: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400',
  grammar: 'text-pink-600 bg-pink-100 dark:bg-pink-900/20 dark:text-pink-400',
  terminology: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400',
  scope: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400'
};

const RefinementTypeIcons: Record<RefinementType, React.ElementType> = {
  clarity: Lightbulb,
  specificity: CheckCircle,
  completeness: Info,
  context: ArrowRight,
  grammar: CheckCircle,
  terminology: Sparkles,
  scope: ArrowRight
};

const AnalysisScore: React.FC<AnalysisScoreProps> = ({ 
  label, 
  labelArabic, 
  score, 
  maxScore, 
  language,
  icon: Icon = CheckCircle 
}) => {
  const displayLabel = language === 'ar' ? labelArabic : label;
  const percentage = (score / maxScore) * 100;
  
  const getScoreColor = () => {
    if (percentage >= 80) return 'text-green-600 bg-green-100';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {displayLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-500",
              percentage >= 80 ? "bg-green-500" : 
              percentage >= 60 ? "bg-yellow-500" : "bg-red-500"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={cn(
          "text-xs font-semibold px-2 py-1 rounded-full",
          getScoreColor()
        )}>
          {score}/{maxScore}
        </span>
      </div>
    </div>
  );
};

const RefinementItem: React.FC<RefinementItemProps> = ({
  refinement,
  language,
  onSelect,
  onCopy,
  onFeedback
}) => {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  
  const Icon = RefinementTypeIcons[refinement.improvementType] || Sparkles;
  const displayQuery = language === 'ar' ? refinement.refinedQueryArabic : refinement.refinedQuery;
  const displayReasoning = language === 'ar' ? refinement.reasoningArabic : refinement.reasoning;
  const isRTL = language === 'ar';

  const getImprovementTypeLabel = (type: RefinementType) => {
    const labels = {
      ar: {
        clarity: 'وضوح',
        specificity: 'تخصص',
        completeness: 'اكتمال',
        context: 'سياق',
        grammar: 'نحو',
        terminology: 'مصطلحات',
        scope: 'نطاق'
      },
      en: {
        clarity: 'Clarity',
        specificity: 'Specificity',
        completeness: 'Completeness',
        context: 'Context',
        grammar: 'Grammar',
        terminology: 'Terminology',
        scope: 'Scope'
      }
    };
    
    return language === 'ar' ? labels.ar[type] : labels.en[type];
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleFeedback = (helpful: boolean) => {
    setFeedback(helpful);
    onFeedback(helpful);
  };

  return (
    <div 
      className={cn(
        "border border-gray-200 dark:border-gray-700 rounded-lg p-4",
        "hover:border-blue-300 dark:hover:border-blue-600 transition-colors",
        "bg-white dark:bg-gray-800"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 mt-1">
          <Icon size={18} className="text-blue-500" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              RefinementTypeColors[refinement.improvementType]
            )}>
              {getImprovementTypeLabel(refinement.improvementType)}
            </span>
            
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Sparkles size={12} />
              <span>{(refinement.score * 100).toFixed(0)}% improvement</span>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
              {displayQuery}
            </p>
          </div>
          
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            <strong>{language === 'ar' ? 'السبب:' : 'Why:'}</strong> {displayReasoning}
          </p>
          
          <div className="text-xs text-green-600 dark:text-green-400 mb-3">
            <strong>{language === 'ar' ? 'التحسن المتوقع:' : 'Expected improvement:'}</strong> {refinement.expectedImprovement}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelect(refinement)}
            className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors"
          >
            {language === 'ar' ? 'استخدم هذا' : 'Use this'}
          </button>
          
          <button
            onClick={() => handleCopy(displayQuery)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title={language === 'ar' ? 'نسخ' : 'Copy'}
          >
            {copied ? (
              <CheckCircle size={14} className="text-green-500" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
        
        {feedback === null ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2">
              {language === 'ar' ? 'مفيد؟' : 'Helpful?'}
            </span>
            <button
              onClick={() => handleFeedback(true)}
              className="p-1 text-gray-400 hover:text-green-500 transition-colors"
            >
              <ThumbsUp size={14} />
            </button>
            <button
              onClick={() => handleFeedback(false)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <ThumbsDown size={14} />
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-500">
            {feedback 
              ? (language === 'ar' ? 'شكراً!' : 'Thanks!')
              : (language === 'ar' ? 'تم التسجيل' : 'Noted')
            }
          </span>
        )}
      </div>
    </div>
  );
};

export const QueryRefinementComponent: React.FC<QueryRefinementProps> = ({
  originalQuery,
  language = 'both',
  includeTranslation = true,
  onRefinementSelect,
  onApplyRefinement,
  className,
  showAnalysis = true,
  showRecommendations = true,
  autoRefresh = false
}) => {
  const [refinements, setRefinements] = useState<QueryRefinement[]>([]);
  const [analysis, setAnalysis] = useState<QueryAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<RefinementRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRefinements = async () => {
    if (!originalQuery.trim()) {
      setRefinements([]);
      setAnalysis(null);
      setRecommendations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/suggestions/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalQuery,
          includeTranslation,
          context: {
            userPreferences: {
              preferredLanguage: language
            }
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        setRefinements(result.data.refinements);
        setAnalysis(result.data.originalAnalysis);
        setRecommendations(result.data.recommendations);
      } else {
        setError(result.error?.message || 'Failed to refine query');
      }
    } catch (err) {
      console.error('Query refinement error:', err);
      setError('Failed to refine query');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (originalQuery.trim()) {
      fetchRefinements();
    }
  }, [originalQuery, includeTranslation, language]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && originalQuery.trim()) {
      const interval = setInterval(fetchRefinements, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [autoRefresh, originalQuery]);

  const handleRefinementSelect = (refinement: QueryRefinement) => {
    const selectedQuery = language === 'ar' ? refinement.refinedQueryArabic : refinement.refinedQuery;
    
    if (onRefinementSelect) {
      onRefinementSelect(selectedQuery);
    }
    
    if (onApplyRefinement) {
      onApplyRefinement(selectedQuery, refinement.improvementType);
    }
  };

  const handleRefinementFeedback = (refinement: QueryRefinement, helpful: boolean) => {
    // Send feedback to API
    const selectedQuery = language === 'ar' ? refinement.refinedQueryArabic : refinement.refinedQuery;
    
    fetch('/api/v1/suggestions/refine', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        originalQuery,
        selectedRefinement: selectedQuery,
        feedback: helpful ? 'helpful' : 'not_helpful',
        improvementType: refinement.improvementType,
        helpfulness: helpful ? 5 : 2,
        appliedRefinement: false
      })
    }).catch(err => console.error('Failed to send feedback:', err));
  };

  const getOverallScore = () => {
    if (!analysis) return 0;
    return (
      analysis.clarity + 
      analysis.specificity + 
      analysis.completeness + 
      analysis.grammarScore + 
      analysis.terminologyAccuracy
    ) / 5;
  };

  if (!originalQuery.trim()) {
    return (
      <div className={cn("text-center py-8 text-gray-500 dark:text-gray-400", className)}>
        <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">
          {language === 'ar' ? 'أدخل استعلاماً لتحسينه' : 'Enter a query to refine it'}
        </p>
        <p className="text-sm">
          {language === 'ar' 
            ? 'سنساعدك في تحسين وضوح وفعالية استعلاماتك'
            : 'We\'ll help improve the clarity and effectiveness of your queries'
          }
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {language === 'ar' ? 'جاري تحليل وتحسين الاستعلام...' : 'Analyzing and refining query...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-center py-8", className)}>
        <AlertTriangle size={48} className="mx-auto mb-4 text-red-500 opacity-50" />
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchRefinements}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mx-auto"
        >
          <RefreshCw size={16} />
          {language === 'ar' ? 'حاول مرة أخرى' : 'Try again'}
        </button>
      </div>
    );
  }

  const overallScore = getOverallScore();
  const isRTL = language === 'ar';

  return (
    <div className={cn("space-y-6", className)} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Original Query Display */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {language === 'ar' ? 'الاستعلام الأصلي' : 'Original Query'}
          </span>
        </div>
        <p className="text-gray-900 dark:text-white font-medium">
          {originalQuery}
        </p>
      </div>

      {/* Analysis Section */}
      {showAnalysis && analysis && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle size={20} />
              {language === 'ar' ? 'تحليل الاستعلام' : 'Query Analysis'}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {language === 'ar' ? 'النتيجة الإجمالية:' : 'Overall Score:'}
              </span>
              <span className={cn(
                "px-3 py-1 rounded-full text-sm font-semibold",
                overallScore >= 8 ? "bg-green-100 text-green-700" :
                overallScore >= 6 ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              )}>
                {overallScore.toFixed(1)}/10
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <AnalysisScore
              label="Clarity"
              labelArabic="الوضوح"
              score={analysis.clarity}
              maxScore={10}
              language={language}
              icon={Lightbulb}
            />
            <AnalysisScore
              label="Specificity"
              labelArabic="التخصص"
              score={analysis.specificity}
              maxScore={10}
              language={language}
              icon={CheckCircle}
            />
            <AnalysisScore
              label="Completeness"
              labelArabic="الاكتمال"
              score={analysis.completeness}
              maxScore={10}
              language={language}
              icon={Info}
            />
            <AnalysisScore
              label="Grammar"
              labelArabic="النحو"
              score={analysis.grammarScore}
              maxScore={10}
              language={language}
              icon={CheckCircle}
            />
            <AnalysisScore
              label="Terminology"
              labelArabic="المصطلحات"
              score={analysis.terminologyAccuracy}
              maxScore={10}
              language={language}
              icon={Sparkles}
            />
          </div>

          {analysis.issues.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'القضايا المحددة' : 'Identified Issues'}
              </h4>
              <div className="space-y-2">
                {analysis.issues.map((issue, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <AlertTriangle 
                      size={14} 
                      className={cn(
                        "mt-0.5",
                        issue.severity === 'high' ? "text-red-500" :
                        issue.severity === 'medium' ? "text-yellow-500" :
                        "text-orange-500"
                      )}
                    />
                    <div>
                      <p className="text-gray-700 dark:text-gray-300">
                        {language === 'ar' ? issue.descriptionArabic : issue.description}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                        {language === 'ar' ? issue.suggestionArabic : issue.suggestion}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Refinements Section */}
      {refinements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Sparkles size={20} />
            {language === 'ar' ? 'الاستعلامات المحسنة' : 'Refined Queries'}
            <span className="text-sm font-normal text-gray-500">({refinements.length})</span>
          </h3>
          
          <div className="space-y-4">
            {refinements.map((refinement, index) => (
              <RefinementItem
                key={index}
                refinement={refinement}
                language={language}
                onSelect={handleRefinementSelect}
                onCopy={(text) => console.log('Copied:', text)}
                onFeedback={(helpful) => handleRefinementFeedback(refinement, helpful)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations Section */}
      {showRecommendations && recommendations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-2">
            <Lightbulb size={20} />
            {language === 'ar' ? 'توصيات للتحسين' : 'Improvement Recommendations'}
          </h3>
          
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  {language === 'ar' ? rec.titleArabic : rec.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {language === 'ar' ? rec.descriptionArabic : rec.description}
                </p>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-3">
                  <p className="text-sm font-mono text-gray-800 dark:text-gray-200">
                    {language === 'ar' ? rec.exampleArabic : rec.example}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};