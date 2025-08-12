'use client';

import React, { useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  Zap,
  Target,
  Lightbulb,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  Settings,
  RefreshCw
} from 'lucide-react';
import { CostMetrics } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CostOptimizationProps {
  data: CostMetrics;
  language?: 'ar' | 'en';
  className?: string;
}

interface OptimizationRecommendation {
  id: string;
  type: 'model_routing' | 'usage_pattern' | 'budget_allocation' | 'performance_cost';
  title: string;
  titleArabic: string;
  description: string;
  descriptionArabic: string;
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  actions: string[];
  actionsArabic: string[];
}

const CostOptimization: React.FC<CostOptimizationProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const [activeView, setActiveView] = useState<'overview' | 'recommendations' | 'analysis'>('overview');
  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);

  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'تحسين التكاليف والتوصيات',
    subtitle: 'تحليل الفرص لتوفير التكاليف وتحسين الكفاءة',
    overview: 'نظرة عامة',
    recommendations: 'التوصيات',
    analysis: 'التحليل المفصل',
    potentialSavings: 'التوفير المحتمل',
    currentSpend: 'الإنفاق الحالي',
    optimizedSpend: 'الإنفاق المُحسن',
    savingsOpportunity: 'فرصة التوفير',
    highPriority: 'أولوية عالية',
    mediumPriority: 'أولوية متوسطة',
    lowPriority: 'أولوية منخفضة',
    implementRecommendation: 'تطبيق التوصية',
    viewDetails: 'عرض التفاصيل',
    dismiss: 'تجاهل',
    effort: 'الجهد',
    impact: 'التأثير',
    status: 'الحالة',
    pending: 'في الانتظار',
    inProgress: 'قيد التنفيذ',
    completed: 'مكتمل',
    dismissed: 'مُتجاهل',
    low: 'منخفض',
    medium: 'متوسط',
    high: 'عالي',
    modelEfficiency: 'كفاءة النماذج',
    usagePatterns: 'أنماط الاستخدام',
    budgetAllocation: 'تخصيص الميزانية',
    costTrends: 'اتجاهات التكلفة',
    optimizationScore: 'نقاط التحسين',
    implementAll: 'تطبيق الكل',
    exportReport: 'تصدير التقرير',
    refreshAnalysis: 'تحديث التحليل',
    monthlyProjection: 'التوقع الشهري',
    costBreakdown: 'تفكيك التكاليف',
    noRecommendations: 'لا توجد توصيات في الوقت الحالي',
    lastUpdated: 'آخر تحديث',
    actions: 'الإجراءات'
  } : {
    title: 'Cost Optimization & Recommendations',
    subtitle: 'Analysis of opportunities to save costs and improve efficiency',
    overview: 'Overview',
    recommendations: 'Recommendations',
    analysis: 'Detailed Analysis',
    potentialSavings: 'Potential Savings',
    currentSpend: 'Current Spend',
    optimizedSpend: 'Optimized Spend',
    savingsOpportunity: 'Savings Opportunity',
    highPriority: 'High Priority',
    mediumPriority: 'Medium Priority',
    lowPriority: 'Low Priority',
    implementRecommendation: 'Implement Recommendation',
    viewDetails: 'View Details',
    dismiss: 'Dismiss',
    effort: 'Effort',
    impact: 'Impact',
    status: 'Status',
    pending: 'Pending',
    inProgress: 'In Progress',
    completed: 'Completed',
    dismissed: 'Dismissed',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    modelEfficiency: 'Model Efficiency',
    usagePatterns: 'Usage Patterns',
    budgetAllocation: 'Budget Allocation',
    costTrends: 'Cost Trends',
    optimizationScore: 'Optimization Score',
    implementAll: 'Implement All',
    exportReport: 'Export Report',
    refreshAnalysis: 'Refresh Analysis',
    monthlyProjection: 'Monthly Projection',
    costBreakdown: 'Cost Breakdown',
    noRecommendations: 'No recommendations available at this time',
    lastUpdated: 'Last Updated',
    actions: 'Actions'
  };

  // Calculate optimization metrics
  const totalPotentialSavings = data.totalCost * 0.15; // Assume 15% potential savings
  const optimizedSpend = data.totalCost - totalPotentialSavings;
  const optimizationScore = Math.min(95, 65 + Math.random() * 30); // Mock score between 65-95

  // Mock recommendations data
  const recommendations: OptimizationRecommendation[] = [
    {
      id: '1',
      type: 'model_routing',
      title: 'Implement Smart Model Routing',
      titleArabic: 'تطبيق التوجيه الذكي للنماذج',
      description: 'Route simple queries to GPT-3.5 and complex ones to GPT-4 to reduce costs by 35%.',
      descriptionArabic: 'توجيه الاستفسارات البسيطة إلى GPT-3.5 والمعقدة إلى GPT-4 لتقليل التكاليف بنسبة 35%.',
      potentialSavings: data.totalCost * 0.35,
      effort: 'medium',
      impact: 'high',
      priority: 'high',
      status: 'pending',
      actions: [
        'Implement query complexity analysis',
        'Set up routing logic',
        'Monitor performance impact',
        'Fine-tune routing rules'
      ],
      actionsArabic: [
        'تطبيق تحليل تعقيد الاستفسارات',
        'إعداد منطق التوجيه',
        'مراقبة تأثير الأداء',
        'ضبط قواعد التوجيه'
      ]
    },
    {
      id: '2',
      type: 'usage_pattern',
      title: 'Optimize Peak Hour Usage',
      titleArabic: 'تحسين الاستخدام في ساعات الذروة',
      description: 'Implement caching and rate limiting during peak hours to reduce API calls by 25%.',
      descriptionArabic: 'تطبيق التخزين المؤقت وتحديد المعدل خلال ساعات الذروة لتقليل استدعاءات API بنسبة 25%.',
      potentialSavings: data.totalCost * 0.25,
      effort: 'low',
      impact: 'medium',
      priority: 'high',
      status: 'pending',
      actions: [
        'Implement response caching',
        'Set up rate limiting',
        'Add queue management',
        'Monitor cache hit rates'
      ],
      actionsArabic: [
        'تطبيق تخزين الاستجابات مؤقتاً',
        'إعداد تحديد المعدل',
        'إضافة إدارة الطوابير',
        'مراقبة معدلات إصابة التخزين المؤقت'
      ]
    },
    {
      id: '3',
      type: 'budget_allocation',
      title: 'Adjust Model Budget Allocation',
      titleArabic: 'تعديل تخصيص ميزانية النماذج',
      description: 'Reallocate 40% of GPT-4 budget to more efficient models for routine tasks.',
      descriptionArabic: 'إعادة تخصيص 40% من ميزانية GPT-4 لنماذج أكثر كفاءة للمهام الروتينية.',
      potentialSavings: data.totalCost * 0.20,
      effort: 'low',
      impact: 'medium',
      priority: 'medium',
      status: 'in_progress',
      actions: [
        'Analyze task complexity distribution',
        'Identify routine vs complex tasks',
        'Update model selection criteria',
        'Monitor quality metrics'
      ],
      actionsArabic: [
        'تحليل توزيع تعقيد المهام',
        'تحديد المهام الروتينية مقابل المعقدة',
        'تحديث معايير اختيار النماذج',
        'مراقبة مقاييس الجودة'
      ]
    },
    {
      id: '4',
      type: 'performance_cost',
      title: 'Optimize Token Usage',
      titleArabic: 'تحسين استخدام الرموز',
      description: 'Reduce token consumption through better prompt engineering and response formatting.',
      descriptionArabic: 'تقليل استهلاك الرموز من خلال هندسة أفضل للمطالبات وتنسيق الاستجابات.',
      potentialSavings: data.totalCost * 0.15,
      effort: 'high',
      impact: 'medium',
      priority: 'medium',
      status: 'pending',
      actions: [
        'Audit current prompts',
        'Implement prompt optimization',
        'Reduce response verbosity',
        'Add token usage monitoring'
      ],
      actionsArabic: [
        'مراجعة المطالبات الحالية',
        'تطبيق تحسين المطالبات',
        'تقليل إطناب الاستجابات',
        'إضافة مراقبة استخدام الرموز'
      ]
    }
  ];

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400';
    }
  };

  // Prepare chart data
  const savingsBreakdownData = recommendations.map(rec => ({
    name: isRTL ? rec.titleArabic.slice(0, 20) + '...' : rec.title.slice(0, 20) + '...',
    value: rec.potentialSavings,
    fill: rec.priority === 'high' ? '#dc2626' : rec.priority === 'medium' ? '#d97706' : '#059669'
  }));

  const monthlyProjectionData = [...Array(6)].map((_, i) => ({
    month: new Date(2024, i, 1).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short' }),
    current: data.monthlyCost * (1 + Math.random() * 0.1),
    optimized: data.monthlyCost * (0.8 + Math.random() * 0.1)
  }));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className={`${isRTL ? 'text-right' : 'text-left'}`}>
        <h3 className={`text-xl font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
          {labels.title}
        </h3>
        <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
          {labels.subtitle}
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-green-700 dark:text-green-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.potentialSavings}
              </p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                {formatCurrency(totalPotentialSavings)}
              </p>
              <p className={`text-xs text-green-600 dark:text-green-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
                {((totalPotentialSavings / data.totalCost) * 100).toFixed(1)}% {labels.savingsOpportunity}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.currentSpend}
              </p>
              <p className="text-2xl font-bold text-saudi-navy-800 dark:text-white">
                {formatCurrency(data.totalCost)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-saudi-gold-600" />
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-blue-700 dark:text-blue-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.optimizedSpend}
              </p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {formatCurrency(optimizedSpend)}
              </p>
            </div>
            <Target className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-purple-700 dark:text-purple-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.optimizationScore}
              </p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                {optimizationScore.toFixed(0)}/100
              </p>
            </div>
            <Zap className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {['overview', 'recommendations', 'analysis'].map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view as any)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === view
                ? 'bg-white dark:bg-gray-600 text-saudi-navy-800 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            } ${isRTL ? 'font-arabic' : ''}`}
          >
            {view === 'overview' ? labels.overview :
             view === 'recommendations' ? labels.recommendations : labels.analysis}
          </button>
        ))}
      </div>

      {/* Content based on active view */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Savings Breakdown Pie Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
              {labels.potentialSavings}
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={savingsBreakdownData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={(entry) => formatCurrency(entry.value)}
                >
                  {savingsBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Projection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
              {labels.monthlyProjection}
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyProjectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#dc2626"
                  strokeWidth={2}
                  name={labels.currentSpend}
                />
                <Line
                  type="monotone"
                  dataKey="optimized"
                  stroke="#059669"
                  strokeWidth={2}
                  name={labels.optimizedSpend}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'recommendations' && (
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Button className={`${isRTL ? 'font-arabic' : ''}`}>
              <CheckCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.implementAll}
            </Button>
            <Button variant="outline" className={`${isRTL ? 'font-arabic' : ''}`}>
              <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.refreshAnalysis}
            </Button>
          </div>

          {recommendations.length === 0 ? (
            <div className={`text-center py-8 ${isRTL ? 'font-arabic' : ''}`}>
              <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">{labels.noRecommendations}</p>
            </div>
          ) : (
            recommendations.map((recommendation) => (
              <div
                key={recommendation.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className={`flex items-center gap-3 mb-3 ${isRTL ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
                      <h4 className={`font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                        {isRTL ? recommendation.titleArabic : recommendation.title}
                      </h4>
                      
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Badge className={`${getPriorityColor(recommendation.priority)} text-xs`}>
                          {recommendation.priority === 'high' ? labels.highPriority :
                           recommendation.priority === 'medium' ? labels.mediumPriority : labels.lowPriority}
                        </Badge>
                        
                        <Badge className={`${getStatusColor(recommendation.status)} text-xs`}>
                          {recommendation.status === 'pending' ? labels.pending :
                           recommendation.status === 'in_progress' ? labels.inProgress :
                           recommendation.status === 'completed' ? labels.completed : labels.dismissed}
                        </Badge>
                      </div>
                    </div>

                    <p className={`text-gray-600 dark:text-gray-400 mb-4 ${isRTL ? 'font-arabic' : ''}`}>
                      {isRTL ? recommendation.descriptionArabic : recommendation.description}
                    </p>

                    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div>
                        <span className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                          {labels.potentialSavings}:
                        </span>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(recommendation.potentialSavings)}
                        </p>
                      </div>

                      <div>
                        <span className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                          {labels.effort}:
                        </span>
                        <p className={`text-sm font-semibold ${
                          recommendation.effort === 'high' ? 'text-red-600' :
                          recommendation.effort === 'medium' ? 'text-yellow-600' : 'text-green-600'
                        } ${isRTL ? 'font-arabic' : ''}`}>
                          {recommendation.effort === 'high' ? labels.high :
                           recommendation.effort === 'medium' ? labels.medium : labels.low}
                        </p>
                      </div>

                      <div>
                        <span className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                          {labels.impact}:
                        </span>
                        <p className={`text-sm font-semibold ${
                          recommendation.impact === 'high' ? 'text-green-600' :
                          recommendation.impact === 'medium' ? 'text-yellow-600' : 'text-gray-600'
                        } ${isRTL ? 'font-arabic' : ''}`}>
                          {recommendation.impact === 'high' ? labels.high :
                           recommendation.impact === 'medium' ? labels.medium : labels.low}
                        </p>
                      </div>
                    </div>

                    {/* Action Items */}
                    <div className={`${isRTL ? 'text-right' : 'text-left'}`}>
                      <span className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                        {labels.actions}:
                      </span>
                      <ul className={`mt-2 space-y-1 ${isRTL ? 'mr-4 font-arabic' : 'ml-4'}`}>
                        {(isRTL ? recommendation.actionsArabic : recommendation.actions).map((action, index) => (
                          <li key={index} className={`text-sm text-gray-600 dark:text-gray-400 flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className={`text-saudi-green-600 ${isRTL ? 'ml-2' : 'mr-2'} mt-0.5`}>•</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className={`flex flex-col gap-2 ${isRTL ? 'items-start' : 'items-end'}`}>
                    {recommendation.status === 'pending' && (
                      <Button className={`${isRTL ? 'font-arabic' : ''}`}>
                        <CheckCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {labels.implementRecommendation}
                      </Button>
                    )}
                    
                    <Button variant="outline" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
                      {labels.viewDetails}
                    </Button>
                    
                    <Button variant="ghost" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
                      {labels.dismiss}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeView === 'analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost Trends */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
              {labels.costTrends}
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.dailyCost.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'short' })}
                />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Bar dataKey="cost" fill="#1a365d" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Model Efficiency Analysis */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
              {labels.modelEfficiency}
            </h4>
            <div className="space-y-4">
              {data.modelBreakdown.map((model, index) => {
                const efficiency = model.cost / model.tokensUsed * 1000; // Cost per 1k tokens
                const isEfficient = efficiency < 0.002;
                
                return (
                  <div key={index} className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <p className={`font-medium text-gray-900 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                        {model.modelName}
                      </p>
                      <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                        {formatCurrency(efficiency)} / 1K tokens
                      </p>
                    </div>
                    
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className={`text-lg font-bold ${isEfficient ? 'text-green-600' : 'text-red-600'}`}>
                        {model.percentage}%
                      </span>
                      {isEfficient ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className={`flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
          {labels.lastUpdated}: {new Date().toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US')}
        </div>
        
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button variant="outline" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
            <BarChart3 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.exportReport}
          </Button>
          
          <Button variant="outline" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
            <Settings className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.settings}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CostOptimization;