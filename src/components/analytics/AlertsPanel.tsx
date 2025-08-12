'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  XCircle,
  CheckCircle,
  Bell,
  BellOff,
  X,
  TrendingUp,
  DollarSign,
  Clock,
  Shield,
  Settings
} from 'lucide-react';
import { AnalyticsAlert } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AlertsPanelProps {
  language?: 'ar' | 'en';
  className?: string;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  language = 'ar',
  className = ''
}) => {
  const [alerts, setAlerts] = useState<AnalyticsAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'التنبيهات والإشعارات',
    subtitle: 'تنبيهات النظام والتوصيات المهمة',
    allAlerts: 'جميع التنبيهات',
    critical: 'حرج',
    warning: 'تحذير',
    info: 'معلومات',
    dismiss: 'إخفاء',
    acknowledge: 'تأكيد',
    acknowledged: 'تم التأكيد',
    showDismissed: 'إظهار المخفية',
    hideDismissed: 'إخفاء المخفية',
    noAlerts: 'لا توجد تنبيهات',
    viewDetails: 'عرض التفاصيل',
    settings: 'إعدادات التنبيهات',
    costThreshold: 'تجاوز حد التكلفة',
    performanceDegradation: 'انخفاض الأداء',
    complianceIssue: 'مشكلة امتثال',
    usageSpike: 'زيادة مفاجئة في الاستخدام',
    budgetAlert: 'تنبيه الميزانية',
    systemAlert: 'تنبيه النظام',
    securityAlert: 'تنبيه أمني',
    justNow: 'الآن',
    minutesAgo: 'دقيقة مضت',
    hoursAgo: 'ساعة مضت',
    daysAgo: 'يوم مضى',
    loading: 'جاري التحميل...'
  } : {
    title: 'Alerts & Notifications',
    subtitle: 'System alerts and important recommendations',
    allAlerts: 'All Alerts',
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info',
    dismiss: 'Dismiss',
    acknowledge: 'Acknowledge',
    acknowledged: 'Acknowledged',
    showDismissed: 'Show Dismissed',
    hideDismissed: 'Hide Dismissed',
    noAlerts: 'No alerts',
    viewDetails: 'View Details',
    settings: 'Alert Settings',
    costThreshold: 'Cost Threshold Exceeded',
    performanceDegradation: 'Performance Degradation',
    complianceIssue: 'Compliance Issue',
    usageSpike: 'Usage Spike',
    budgetAlert: 'Budget Alert',
    systemAlert: 'System Alert',
    securityAlert: 'Security Alert',
    justNow: 'Just now',
    minutesAgo: 'min ago',
    hoursAgo: 'hrs ago',
    daysAgo: 'days ago',
    loading: 'Loading...'
  };

  // Mock alerts data - In real app, this would come from API
  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockAlerts: AnalyticsAlert[] = [
        {
          id: '1',
          type: 'cost_threshold',
          severity: 'critical',
          title: 'Budget Threshold Exceeded',
          titleArabic: 'تجاوز حد الميزانية',
          message: 'Monthly spending has exceeded 85% of allocated budget. Consider optimizing model usage.',
          messageArabic: 'تجاوز الإنفاق الشهري 85% من الميزانية المخصصة. فكر في تحسين استخدام النماذج.',
          threshold: 85,
          currentValue: 87.3,
          createdAt: '2024-01-12T10:30:00Z',
          acknowledged: false
        },
        {
          id: '2',
          type: 'performance_degradation',
          severity: 'warning',
          title: 'Response Time Increased',
          titleArabic: 'زيادة في زمن الاستجابة',
          message: 'Average response time has increased by 23% in the last hour. Check system load.',
          messageArabic: 'زاد متوسط زمن الاستجابة بنسبة 23% في الساعة الماضية. تحقق من حمولة النظام.',
          threshold: 20,
          currentValue: 23,
          createdAt: '2024-01-12T11:15:00Z',
          acknowledged: false
        },
        {
          id: '3',
          type: 'compliance_issue',
          severity: 'error',
          title: 'Compliance Violation Detected',
          titleArabic: 'تم اكتشاف انتهاك للامتثال',
          message: 'Document processing violated labor law compliance standards. Review and correct immediately.',
          messageArabic: 'انتهكت معالجة المستندات معايير الامتثال لقانون العمل. راجع وصحح فورًا.',
          createdAt: '2024-01-12T09:45:00Z',
          acknowledged: true,
          acknowledgedBy: 'admin@company.com',
          acknowledgedAt: '2024-01-12T10:00:00Z'
        },
        {
          id: '4',
          type: 'usage_spike',
          severity: 'info',
          title: 'High Activity Period',
          titleArabic: 'فترة نشاط عالي',
          message: 'User activity increased by 45% compared to usual patterns. System performing well.',
          messageArabic: 'زاد نشاط المستخدمين بنسبة 45% مقارنة بالأنماط المعتادة. النظام يعمل بشكل جيد.',
          threshold: 40,
          currentValue: 45,
          createdAt: '2024-01-12T08:20:00Z',
          acknowledged: false
        },
        {
          id: '5',
          type: 'cost_threshold',
          severity: 'warning',
          title: 'Model Cost Optimization',
          titleArabic: 'تحسين تكلفة النموذج',
          message: 'GPT-4 usage is 60% higher than GPT-3.5. Consider routing simple queries to less expensive models.',
          messageArabic: 'استخدام GPT-4 أعلى بنسبة 60% من GPT-3.5. فكر في توجيه الاستفسارات البسيطة إلى نماذج أقل تكلفة.',
          createdAt: '2024-01-12T07:30:00Z',
          acknowledged: false
        }
      ];

      setAlerts(mockAlerts);
      setLoading(false);
    };

    fetchAlerts();
  }, []);

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (!showDismissed && alert.acknowledged) return false;
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  // Get alert icon
  const getAlertIcon = (type: string, severity: string) => {
    const baseClasses = "h-5 w-5";
    
    switch (severity) {
      case 'critical':
        return <XCircle className={`${baseClasses} text-red-600`} />;
      case 'error':
        return <AlertTriangle className={`${baseClasses} text-red-500`} />;
      case 'warning':
        return <AlertCircle className={`${baseClasses} text-yellow-500`} />;
      case 'info':
        return <Info className={`${baseClasses} text-blue-500`} />;
      default:
        return <Bell className={`${baseClasses} text-gray-500`} />;
    }
  };

  // Get alert background color
  const getAlertBg = (severity: string, acknowledged: boolean) => {
    const opacity = acknowledged ? 'opacity-60' : '';
    
    switch (severity) {
      case 'critical':
        return `bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 ${opacity}`;
      case 'error':
        return `bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 ${opacity}`;
      case 'warning':
        return `bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 ${opacity}`;
      case 'info':
        return `bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ${opacity}`;
      default:
        return `bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${opacity}`;
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return labels.justNow;
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} ${labels.minutesAgo}`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} ${labels.hoursAgo}`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} ${labels.daysAgo}`;
    }
  };

  // Handle dismiss alert
  const handleDismissAlert = (alertId: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true, acknowledgedAt: new Date().toISOString() }
        : alert
    ));
  };

  // Get alert type label
  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'cost_threshold':
        return labels.costThreshold;
      case 'performance_degradation':
        return labels.performanceDegradation;
      case 'compliance_issue':
        return labels.complianceIssue;
      case 'usage_spike':
        return labels.usageSpike;
      default:
        return labels.systemAlert;
    }
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h3 className={`text-lg font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
            {labels.title}
          </h3>
          <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
            {labels.subtitle}
          </p>
        </div>

        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDismissed(!showDismissed)}
            className={`${isRTL ? 'font-arabic' : ''}`}
          >
            {showDismissed ? (
              <BellOff className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            ) : (
              <Bell className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            )}
            {showDismissed ? labels.hideDismissed : labels.showDismissed}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className={`${isRTL ? 'font-arabic' : ''}`}
          >
            <Settings className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.settings}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6">
        {['all', 'critical', 'warning', 'info'].map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType as any)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${
              filter === filterType
                ? 'bg-white dark:bg-gray-600 text-saudi-navy-800 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            } ${isRTL ? 'font-arabic' : ''}`}
          >
            {filterType === 'all' ? labels.allAlerts :
             filterType === 'critical' ? labels.critical :
             filterType === 'warning' ? labels.warning : labels.info}
            {filterType !== 'all' && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-500 rounded text-xs">
                {alerts.filter(a => a.severity === filterType && (!showDismissed ? !a.acknowledged : true)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className={`text-center py-8 ${isRTL ? 'font-arabic' : ''}`}>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">{labels.noAlerts}</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-4 transition-all duration-200 ${getAlertBg(alert.severity, alert.acknowledged)}`}
            >
              <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-start gap-3 flex-1 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}>
                  {getAlertIcon(alert.type, alert.severity)}
                  
                  <div className="flex-1">
                    <div className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
                      <h4 className={`font-medium text-gray-900 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                        {isRTL ? alert.titleArabic : alert.title}
                      </h4>
                      
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${
                          alert.severity === 'critical' ? 'border-red-200 text-red-700 dark:text-red-400' :
                          alert.severity === 'error' ? 'border-red-200 text-red-700 dark:text-red-400' :
                          alert.severity === 'warning' ? 'border-yellow-200 text-yellow-700 dark:text-yellow-400' :
                          'border-blue-200 text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        {getAlertTypeLabel(alert.type)}
                      </Badge>
                    </div>
                    
                    <p className={`text-sm text-gray-600 dark:text-gray-400 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
                      {isRTL ? alert.messageArabic : alert.message}
                    </p>
                    
                    {alert.threshold && alert.currentValue && (
                      <div className={`text-xs text-gray-500 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
                        {isRTL ? 'القيمة الحالية' : 'Current'}: {alert.currentValue}
                        {typeof alert.currentValue === 'number' && alert.currentValue > alert.threshold && '%'} | 
                        {isRTL ? ' الحد الأقصى' : ' Threshold'}: {alert.threshold}%
                      </div>
                    )}
                    
                    <div className={`flex items-center gap-4 text-xs text-gray-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className={isRTL ? 'font-arabic' : ''}>
                        {formatTimeAgo(alert.createdAt)}
                      </span>
                      
                      {alert.acknowledged && (
                        <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span className={`text-green-600 ${isRTL ? 'font-arabic' : ''}`}>
                            {labels.acknowledged}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {!alert.acknowledged && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDismissAlert(alert.id)}
                      className={`${isRTL ? 'font-arabic' : ''}`}
                    >
                      <X className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {labels.dismiss}
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${isRTL ? 'font-arabic' : ''}`}
                  >
                    {labels.viewDetails}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredAlerts.length > 0 && (
        <div className={`mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse font-arabic' : ''}`}>
            <span className="text-gray-600 dark:text-gray-400">
              {isRTL ? 'إجمالي التنبيهات' : 'Total alerts'}: {filteredAlerts.length}
            </span>
            
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-red-600">
                {isRTL ? 'حرجة' : 'Critical'}: {filteredAlerts.filter(a => a.severity === 'critical').length}
              </span>
              <span className="text-yellow-600">
                {isRTL ? 'تحذيرات' : 'Warnings'}: {filteredAlerts.filter(a => a.severity === 'warning').length}
              </span>
              <span className="text-green-600">
                {isRTL ? 'تم التأكيد' : 'Acknowledged'}: {filteredAlerts.filter(a => a.acknowledged).length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;