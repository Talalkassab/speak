'use client';

import React from 'react';
import {
  Users,
  MessageSquare,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  Activity,
  Zap
} from 'lucide-react';
import { AnalyticsMetrics, TimeRange } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';

interface OverviewCardsProps {
  data: AnalyticsMetrics;
  language?: 'ar' | 'en';
  timeRange: TimeRange;
  className?: string;
}

const OverviewCards: React.FC<OverviewCardsProps> = ({
  data,
  language = 'ar',
  timeRange,
  className = ''
}) => {
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    totalUsers: 'إجمالي المستخدمين',
    activeUsers: 'المستخدمون النشطون',
    totalConversations: 'إجمالي المحادثات',
    documentsProcessed: 'المستندات المعالجة',
    totalCost: 'إجمالي التكلفة',
    monthlyCost: 'التكلفة الشهرية',
    avgResponseTime: 'متوسط زمن الاستجابة',
    systemUptime: 'وقت تشغيل النظام',
    complianceScore: 'درجة الامتثال',
    errorRate: 'معدل الأخطاء',
    todayVsYesterday: 'اليوم مقابل أمس',
    thisWeekVsLast: 'هذا الأسبوع مقابل الماضي',
    thisMonthVsLast: 'هذا الشهر مقابل الماضي',
    increase: 'زيادة',
    decrease: 'انخفاض',
    stable: 'مستقر',
    excellent: 'ممتاز',
    good: 'جيد',
    warning: 'تحذير',
    critical: 'حرج',
    seconds: 'ثانية',
    minutes: 'دقيقة',
    hours: 'ساعة',
    templatesGenerated: 'القوالب المُولدة',
    apiCalls: 'استدعاءات API',
    peakHour: 'ساعة الذروة',
    budgetUtilization: 'استخدام الميزانية'
  } : {
    totalUsers: 'Total Users',
    activeUsers: 'Active Users',
    totalConversations: 'Total Conversations',
    documentsProcessed: 'Documents Processed',
    totalCost: 'Total Cost',
    monthlyCost: 'Monthly Cost',
    avgResponseTime: 'Avg Response Time',
    systemUptime: 'System Uptime',
    complianceScore: 'Compliance Score',
    errorRate: 'Error Rate',
    todayVsYesterday: 'Today vs Yesterday',
    thisWeekVsLast: 'This Week vs Last',
    thisMonthVsLast: 'This Month vs Last',
    increase: 'Increase',
    decrease: 'Decrease',
    stable: 'Stable',
    excellent: 'Excellent',
    good: 'Good',
    warning: 'Warning',
    critical: 'Critical',
    seconds: 'sec',
    minutes: 'min',
    hours: 'hrs',
    templatesGenerated: 'Templates Generated',
    apiCalls: 'API Calls',
    peakHour: 'Peak Hour',
    budgetUtilization: 'Budget Usage'
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format numbers
  const formatNumber = (number: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US').format(number);
  };

  // Calculate trend badge
  const getTrendBadge = (current: number, previous: number, isPercentage = false) => {
    const change = current - previous;
    const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
    
    if (Math.abs(changePercent) < 1) {
      return (
        <Badge variant="secondary" className={`${isRTL ? 'font-arabic' : ''} text-xs`}>
          {labels.stable}
        </Badge>
      );
    }

    const isPositive = change > 0;
    const displayValue = isPercentage ? `${Math.abs(changePercent).toFixed(1)}%` : formatNumber(Math.abs(change));

    return (
      <Badge
        variant={isPositive ? "default" : "destructive"}
        className={`${isRTL ? 'font-arabic' : ''} text-xs flex items-center gap-1`}
      >
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {displayValue}
      </Badge>
    );
  };

  // Get status badge for compliance and performance
  const getStatusBadge = (value: number, thresholds: { excellent: number; good: number; warning: number }) => {
    if (value >= thresholds.excellent) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          {labels.excellent}
        </Badge>
      );
    } else if (value >= thresholds.good) {
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          {labels.good}
        </Badge>
      );
    } else if (value >= thresholds.warning) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {labels.warning}
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {labels.critical}
        </Badge>
      );
    }
  };

  // Format response time
  const formatResponseTime = (seconds: number) => {
    if (seconds < 1) {
      return `${Math.round(seconds * 1000)}ms`;
    } else if (seconds < 60) {
      return `${seconds.toFixed(1)} ${labels.seconds}`;
    } else if (seconds < 3600) {
      return `${(seconds / 60).toFixed(1)} ${labels.minutes}`;
    } else {
      return `${(seconds / 3600).toFixed(1)} ${labels.hours}`;
    }
  };

  const cards = [
    {
      title: labels.totalUsers,
      value: formatNumber(data.activity.totalUsers),
      subValue: `${formatNumber(data.activity.activeUsers)} ${labels.activeUsers}`,
      icon: Users,
      trend: getTrendBadge(data.activity.totalUsers, data.activity.totalUsers * 0.95),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    {
      title: labels.totalConversations,
      value: formatNumber(data.usage.totalMessages),
      subValue: `${formatNumber(data.usage.totalApiCalls)} ${labels.apiCalls}`,
      icon: MessageSquare,
      trend: getTrendBadge(data.usage.totalMessages, data.usage.totalMessages * 0.88),
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    {
      title: labels.documentsProcessed,
      value: formatNumber(data.usage.totalDocuments),
      subValue: `${formatNumber(data.usage.totalTemplatesGenerated)} ${labels.templatesGenerated}`,
      icon: FileText,
      trend: getTrendBadge(data.usage.totalDocuments, data.usage.totalDocuments * 0.92),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800'
    },
    {
      title: labels.totalCost,
      value: formatCurrency(data.cost.totalCost),
      subValue: `${labels.budgetUtilization}: ${Math.round(data.cost.budgetUtilization.utilizationPercentage)}%`,
      icon: DollarSign,
      trend: getTrendBadge(data.cost.totalCost, data.cost.totalCost * 0.85),
      color: 'text-saudi-gold-600',
      bgColor: 'bg-saudi-gold-50 dark:bg-saudi-gold-900/20',
      borderColor: 'border-saudi-gold-200 dark:border-saudi-gold-800'
    },
    {
      title: labels.avgResponseTime,
      value: formatResponseTime(data.performance.averageResponseTime),
      subValue: `P95: ${formatResponseTime(data.performance.p95ResponseTime)}`,
      icon: Clock,
      trend: getStatusBadge(data.performance.averageResponseTime, { excellent: 2, good: 5, warning: 10 }),
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800'
    },
    {
      title: labels.systemUptime,
      value: `${data.performance.uptime.toFixed(2)}%`,
      subValue: `${labels.errorRate}: ${data.performance.errorRate.toFixed(2)}%`,
      icon: Activity,
      trend: getStatusBadge(data.performance.uptime, { excellent: 99.9, good: 99.5, warning: 99 }),
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      borderColor: 'border-indigo-200 dark:border-indigo-800'
    },
    {
      title: labels.complianceScore,
      value: `${data.compliance.overallScore}/100`,
      subValue: `${data.compliance.issuesFound.length} ${isRTL ? 'مشاكل مكتشفة' : 'issues found'}`,
      icon: Shield,
      trend: getStatusBadge(data.compliance.overallScore, { excellent: 90, good: 80, warning: 70 }),
      color: 'text-saudi-green-600',
      bgColor: 'bg-saudi-green-50 dark:bg-saudi-green-900/20',
      borderColor: 'border-saudi-green-200 dark:border-saudi-green-800'
    },
    {
      title: labels.peakHour,
      value: `${Math.max(...data.usage.peakUsageHours.map(p => p.hour))}:00`,
      subValue: `${formatNumber(Math.max(...data.usage.peakUsageHours.map(p => p.averageMessages)))} ${labels.totalConversations}`,
      icon: Zap,
      trend: (
        <Badge variant="outline" className={`${isRTL ? 'font-arabic' : ''} text-xs`}>
          {isRTL ? 'ذروة النشاط' : 'Peak Activity'}
        </Badge>
      ),
      color: 'text-pink-600',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20',
      borderColor: 'border-pink-200 dark:border-pink-800'
    }
  ];

  return (
    <div className={`${className}`}>
      <div className={`mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
        <h2 className={`text-xl font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
          {isRTL ? 'نظرة عامة على المقاييس الرئيسية' : 'Key Metrics Overview'}
        </h2>
        <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
          {isRTL ? 'ملخص لأهم المؤشرات والإحصائيات' : 'Summary of the most important indicators and statistics'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const IconComponent = card.icon;
          return (
            <div
              key={index}
              className={`
                ${card.bgColor} ${card.borderColor} 
                border rounded-lg p-4 transition-all duration-200 
                hover:shadow-md hover:scale-105
              `}
            >
              <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`${isRTL ? 'text-right' : 'text-left'} flex-1`}>
                  <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                    {card.title}
                  </p>
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {card.value}
                    </p>
                    <p className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
                      {card.subValue}
                    </p>
                  </div>
                  <div className="mt-3">
                    {card.trend}
                  </div>
                </div>
                <IconComponent className={`h-8 w-8 ${card.color} ${isRTL ? 'ml-3' : 'mr-3'}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Insights */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''} mb-4`}>
          <h3 className={`text-md font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
            {isRTL ? 'رؤى سريعة' : 'Quick Insights'}
          </h3>
          <Badge variant="outline" className={`${isRTL ? 'font-arabic' : ''}`}>
            {timeRange.period === 'day' 
              ? (isRTL ? 'يومي' : 'Daily')
              : timeRange.period === 'week'
              ? (isRTL ? 'أسبوعي' : 'Weekly')
              : (isRTL ? 'شهري' : 'Monthly')
            }
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'font-arabic' : ''}`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isRTL ? 'أكثر الساعات نشاطًا' : 'Most Active Hour'}
            </p>
            <p className="text-lg font-semibold text-saudi-navy-800 dark:text-white mt-1">
              {Math.max(...data.usage.peakUsageHours.map(p => p.hour))}:00
            </p>
          </div>

          <div className={`text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'font-arabic' : ''}`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isRTL ? 'أفضل معدل استجابة' : 'Best Response Time'}
            </p>
            <p className="text-lg font-semibold text-saudi-green-600 mt-1">
              {formatResponseTime(Math.min(...data.cost.modelBreakdown.map(m => m.averageResponseTime)))}
            </p>
          </div>

          <div className={`text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'font-arabic' : ''}`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isRTL ? 'وفورات متوقعة' : 'Projected Savings'}
            </p>
            <p className="text-lg font-semibold text-saudi-gold-600 mt-1">
              {formatCurrency(Math.max(0, data.cost.budgetUtilization.monthlyBudget - data.cost.projectedMonthlyCost))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewCards;