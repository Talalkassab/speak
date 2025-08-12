'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  AlertTriangle, 
  Wifi, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  RefreshCw,
  Settings,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { VoiceError } from '@/types/voice';

interface VoiceErrorHandlerProps {
  error?: VoiceError;
  language?: 'ar' | 'en';
  onRetry?: () => void;
  onDismiss?: () => void;
  onOpenSettings?: () => void;
  className?: string;
  showIcon?: boolean;
  variant?: 'banner' | 'toast' | 'inline';
}

interface ErrorSolution {
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  action?: {
    label: string;
    labelAr?: string;
    onClick: () => void;
  };
  steps?: Array<{
    step: string;
    stepAr?: string;
  }>;
}

export function VoiceErrorHandler({
  error,
  language = 'ar',
  onRetry,
  onDismiss,
  onOpenSettings,
  className,
  showIcon = true,
  variant = 'inline',
}: VoiceErrorHandlerProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isRTL = language === 'ar';

  // Get error icon
  const getErrorIcon = useCallback(() => {
    if (!error || !showIcon) return null;

    switch (error.type) {
      case 'permission':
        return <MicOff className="w-5 h-5 text-red-500" />;
      case 'network':
        return <Wifi className="w-5 h-5 text-orange-500" />;
      case 'processing':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unsupported':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  }, [error, showIcon]);

  // Get error severity
  const getErrorSeverity = useCallback(() => {
    if (!error) return 'info';
    
    switch (error.type) {
      case 'permission':
        return 'error';
      case 'network':
        return 'warning';
      case 'processing':
        return 'warning';
      case 'unsupported':
        return 'info';
      default:
        return 'error';
    }
  }, [error]);

  // Get error solutions
  const getErrorSolutions = useCallback((): ErrorSolution[] => {
    if (!error) return [];

    const solutions: ErrorSolution[] = [];

    switch (error.type) {
      case 'permission':
        solutions.push({
          title: 'Enable microphone access',
          titleAr: 'تفعيل الوصول للميكروفون',
          description: 'Allow microphone access in your browser settings',
          descriptionAr: 'السماح بالوصول للميكروفون في إعدادات المتصفح',
          steps: [
            {
              step: 'Click the microphone icon in your browser address bar',
              stepAr: 'اضغط على رمز الميكروفون في شريط العنوان'
            },
            {
              step: 'Select "Allow" for microphone access',
              stepAr: 'اختر "السماح" للوصول للميكروفون'
            },
            {
              step: 'Refresh the page if needed',
              stepAr: 'حدث الصفحة عند الحاجة'
            }
          ]
        });
        
        if (navigator.mediaDevices) {
          solutions.push({
            title: 'Check system microphone',
            titleAr: 'فحص ميكروفون النظام',
            description: 'Make sure your microphone is connected and working',
            descriptionAr: 'تأكد من أن الميكروفون متصل ويعمل',
            action: {
              label: 'Test microphone',
              labelAr: 'اختبار الميكروفون',
              onClick: () => testMicrophone()
            }
          });
        }
        break;

      case 'network':
        solutions.push({
          title: 'Check internet connection',
          titleAr: 'فحص الاتصال بالإنترنت',
          description: 'Voice processing requires a stable internet connection',
          descriptionAr: 'معالجة الصوت تتطلب اتصال إنترنت مستقر',
          action: {
            label: 'Retry connection',
            labelAr: 'إعادة المحاولة',
            onClick: () => handleRetry()
          }
        });

        if (error.code === 'whisper_api_error') {
          solutions.push({
            title: 'Try voice input again',
            titleAr: 'جرب الإدخال الصوتي مرة أخرى',
            description: 'The voice processing service may be temporarily unavailable',
            descriptionAr: 'قد تكون خدمة معالجة الصوت غير متاحة مؤقتاً'
          });
        }
        break;

      case 'processing':
        solutions.push({
          title: 'Speak more clearly',
          titleAr: 'تحدث بوضوح أكثر',
          description: 'Try speaking slower and more clearly',
          descriptionAr: 'حاول التحدث ببطء ووضوح أكثر'
        });

        solutions.push({
          title: 'Check audio quality',
          titleAr: 'فحص جودة الصوت',
          description: 'Reduce background noise and move closer to the microphone',
          descriptionAr: 'قلل الضوضاء الخلفية واقترب من الميكروفون'
        });
        break;

      case 'unsupported':
        solutions.push({
          title: 'Use a supported browser',
          titleAr: 'استخدم متصفح مدعوم',
          description: 'Voice features work best in Chrome, Firefox, Safari, or Edge',
          descriptionAr: 'الميزات الصوتية تعمل بشكل أفضل في Chrome أو Firefox أو Safari أو Edge'
        });

        solutions.push({
          title: 'Update your browser',
          titleAr: 'حدث متصفحك',
          description: 'Make sure you\'re using the latest version of your browser',
          descriptionAr: 'تأكد من أنك تستخدم أحدث إصدار من متصفحك'
        });
        break;

      default:
        solutions.push({
          title: 'Refresh and try again',
          titleAr: 'حدث الصفحة وحاول مرة أخرى',
          description: 'Sometimes a simple refresh resolves the issue',
          descriptionAr: 'أحياناً تحديث الصفحة يحل المشكلة',
          action: {
            label: 'Refresh page',
            labelAr: 'تحديث الصفحة',
            onClick: () => window.location.reload()
          }
        });
    }

    return solutions;
  }, [error, isRTL]);

  // Test microphone access
  const testMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      // Show success message
      alert(language === 'ar' 
        ? 'الميكروفون يعمل بشكل طبيعي!' 
        : 'Microphone is working properly!'
      );
    } catch (error) {
      console.error('Microphone test failed:', error);
      alert(language === 'ar'
        ? 'لا يمكن الوصول للميكروفون. تحقق من الإعدادات.'
        : 'Cannot access microphone. Please check your settings.'
      );
    }
  }, [language]);

  // Handle retry
  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, isRetrying]);

  // Auto-dismiss certain errors after delay
  useEffect(() => {
    if (!error || !onDismiss) return;

    // Auto-dismiss processing errors after 10 seconds
    if (error.type === 'processing') {
      const timeout = setTimeout(() => {
        onDismiss();
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [error, onDismiss]);

  if (!error) return null;

  const severity = getErrorSeverity();
  const solutions = getErrorSolutions();
  const errorMessage = language === 'ar' && error.messageAr ? error.messageAr : error.message;

  // Variant-specific styles
  const getVariantStyles = () => {
    const base = cn(
      "rounded-lg border transition-all duration-200",
      isRTL && "text-right font-arabic"
    );

    switch (variant) {
      case 'banner':
        return cn(base, "p-4 mb-4");
      case 'toast':
        return cn(base, "p-3 shadow-lg max-w-sm");
      case 'inline':
      default:
        return cn(base, "p-3");
    }
  };

  const getSeverityStyles = () => {
    switch (severity) {
      case 'error':
        return "border-red-200 bg-red-50 text-red-900";
      case 'warning':
        return "border-orange-200 bg-orange-50 text-orange-900";
      case 'info':
        return "border-blue-200 bg-blue-50 text-blue-900";
      default:
        return "border-gray-200 bg-gray-50 text-gray-900";
    }
  };

  return (
    <div className={cn(getVariantStyles(), getSeverityStyles(), className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {getErrorIcon()}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">
                {error.type === 'permission' && (language === 'ar' ? 'مشكلة في الأذونات' : 'Permission Error')}
                {error.type === 'network' && (language === 'ar' ? 'مشكلة في الشبكة' : 'Network Error')}
                {error.type === 'processing' && (language === 'ar' ? 'مشكلة في المعالجة' : 'Processing Error')}
                {error.type === 'unsupported' && (language === 'ar' ? 'غير مدعوم' : 'Unsupported')}
                {error.type === 'unknown' && (language === 'ar' ? 'خطأ غير معروف' : 'Unknown Error')}
              </h4>
              
              {error.code && (
                <span className="text-xs opacity-60 font-mono">
                  {error.code}
                </span>
              )}
            </div>
            
            <p className="text-sm mt-1 opacity-80">
              {errorMessage}
            </p>
          </div>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <Button
            onClick={onDismiss}
            variant="ghost"
            size="sm"
            className="flex-shrink-0 w-6 h-6 p-0 opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Actions */}
      {(onRetry || solutions.length > 0) && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {onRetry && (
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              {isRetrying ? (
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </Button>
          )}

          {solutions.length > 0 && (
            <Button
              onClick={() => setShowDetails(!showDetails)}
              size="sm"
              variant="ghost"
              className="text-xs"
            >
              <Info className="w-3 h-3 mr-1" />
              {language === 'ar' ? 'الحلول' : 'Solutions'}
            </Button>
          )}

          {onOpenSettings && (
            <Button
              onClick={onOpenSettings}
              size="sm"
              variant="ghost"
              className="text-xs"
            >
              <Settings className="w-3 h-3 mr-1" />
              {language === 'ar' ? 'الإعدادات' : 'Settings'}
            </Button>
          )}
        </div>
      )}

      {/* Solutions */}
      {showDetails && solutions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-current border-opacity-20">
          <h5 className="text-sm font-medium mb-2">
            {language === 'ar' ? 'الحلول المقترحة:' : 'Suggested solutions:'}
          </h5>
          
          <div className="space-y-3">
            {solutions.map((solution, index) => (
              <div key={index} className="text-sm">
                <div className="font-medium">
                  {language === 'ar' && solution.titleAr ? solution.titleAr : solution.title}
                </div>
                <div className="opacity-80 mt-1">
                  {language === 'ar' && solution.descriptionAr ? solution.descriptionAr : solution.description}
                </div>
                
                {solution.steps && (
                  <ol className="list-decimal list-inside mt-2 ml-4 space-y-1 text-xs opacity-70">
                    {solution.steps.map((step, stepIndex) => (
                      <li key={stepIndex}>
                        {language === 'ar' && step.stepAr ? step.stepAr : step.step}
                      </li>
                    ))}
                  </ol>
                )}
                
                {solution.action && (
                  <Button
                    onClick={solution.action.onClick}
                    size="sm"
                    variant="outline"
                    className="mt-2 text-xs"
                  >
                    {language === 'ar' && solution.action.labelAr ? solution.action.labelAr : solution.action.label}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceErrorHandler;