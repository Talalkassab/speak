'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Users,
  BarChart3
} from 'lucide-react';
import type { CostOverviewData } from '@/types/enhanced-cost-analytics';

interface CostOverviewCardsProps {
  data: CostOverviewData;
  language?: 'ar' | 'en';
  className?: string;
}

const CostOverviewCards: React.FC<CostOverviewCardsProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    totalCost: 'إجمالي التكلفة',
    dailyCost: 'التكلفة اليومية',
    monthlyCost: 'التكلفة الشهرية',
    projectedCost: 'التكلفة المتوقعة',
    budgetUtilization: 'استخدام الميزانية',
    costTrend: 'اتجاه التكلفة',
    savingsOpportunities: 'فرص التوفير',
    efficiencyScore: 'نقاط الكفاءة',
    vsLastMonth: 'مقارنة بالشهر الماضي',
    vsLastWeek: 'مقارنة بالأسبوع الماضي',
    remainingBudget: 'الميزانية المتبقية',
    onTrack: 'في المسار الصحيح',
    overBudget: 'تجاوز الميزانية',
    underBudget: 'أقل من الميزانية',
    excellent: 'ممتاز',
    good: 'جيد',
    needsImprovement: 'يحتاج تحسين',
    thisMonth: 'هذا الشهر',
    today: 'اليوم',
    potential: 'محتمل',
    current: 'حالي'
  } : {
    totalCost: 'Total Cost',
    dailyCost: 'Daily Cost',
    monthlyCost: 'Monthly Cost',
    projectedCost: 'Projected Cost',
    budgetUtilization: 'Budget Utilization',
    costTrend: 'Cost Trend',
    savingsOpportunities: 'Savings Opportunities',
    efficiencyScore: 'Efficiency Score',
    vsLastMonth: 'vs Last Month',
    vsLastWeek: 'vs Last Week',
    remainingBudget: 'Remaining Budget',
    onTrack: 'On Track',
    overBudget: 'Over Budget',
    underBudget: 'Under Budget',
    excellent: 'Excellent',
    good: 'Good',
    needsImprovement: 'Needs Improvement',
    thisMonth: 'This Month',
    today: 'Today',
    potential: 'Potential',
    current: 'Current'
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    } else if (trend < 0) {
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    }
    return <BarChart3 className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-red-600';
    if (trend < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getBudgetStatus = (utilization: number) => {
    if (utilization > 100) return { label: labels.overBudget, color: 'bg-red-100 text-red-800 border-red-200' };
    if (utilization > 85) return { label: labels.onTrack, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: labels.underBudget, color: 'bg-green-100 text-green-800 border-green-200' };
  };

  const getEfficiencyLevel = (score: number) => {
    if (score >= 90) return { label: labels.excellent, color: 'bg-green-100 text-green-800' };
    if (score >= 70) return { label: labels.good, color: 'bg-blue-100 text-blue-800' };
    return { label: labels.needsImprovement, color: 'bg-orange-100 text-orange-800' };
  };

  const budgetStatus = getBudgetStatus(data.budgetUtilization);
  const efficiencyLevel = getEfficiencyLevel(data.costEfficiencyScore);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {/* Total Monthly Cost */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className={`text-sm font-medium text-blue-700 dark:text-blue-400 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.monthlyCost}
            </p>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-200">
              {formatCurrency(data.monthlyCost)}
            </p>
            <div className={`flex items-center gap-2 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {getTrendIcon(data.costTrend)}
              <span className={`text-sm font-medium ${getTrendColor(data.costTrend)} ${isRTL ? 'font-arabic' : ''}`}>
                {Math.abs(data.costTrend).toFixed(1)}% {labels.vsLastMonth}
              </span>
            </div>
          </div>
          <DollarSign className="h-10 w-10 text-blue-600" />
        </div>
      </Card>

      {/* Daily Cost */}
      <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className={`text-sm font-medium text-green-700 dark:text-green-400 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.dailyCost}
            </p>
            <p className="text-3xl font-bold text-green-900 dark:text-green-200">
              {formatCurrency(data.dailyCost)}
            </p>
            <p className={`text-sm text-green-600 dark:text-green-400 mt-2 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.today}
            </p>
          </div>
          <Calendar className="h-10 w-10 text-green-600" />
        </div>
      </Card>

      {/* Budget Utilization */}
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className={`text-sm font-medium text-purple-700 dark:text-purple-400 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.budgetUtilization}
            </p>
            <p className="text-3xl font-bold text-purple-900 dark:text-purple-200">
              {data.budgetUtilization.toFixed(1)}%
            </p>
            <div className="mt-2">
              <Badge className={`${budgetStatus.color} text-xs ${isRTL ? 'font-arabic' : ''}`}>
                {budgetStatus.label}
              </Badge>
            </div>
          </div>
          <Target className="h-10 w-10 text-purple-600" />
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, data.budgetUtilization)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Efficiency Score */}
      <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className={`text-sm font-medium text-orange-700 dark:text-orange-400 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.efficiencyScore}
            </p>
            <p className="text-3xl font-bold text-orange-900 dark:text-orange-200">
              {data.costEfficiencyScore.toFixed(0)}/100
            </p>
            <div className="mt-2">
              <Badge className={`${efficiencyLevel.color} text-xs ${isRTL ? 'font-arabic' : ''}`}>
                {efficiencyLevel.label}
              </Badge>
            </div>
          </div>
          <Zap className="h-10 w-10 text-orange-600" />
        </div>
      </Card>

      {/* Projected Monthly Cost */}
      <Card className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-800">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className={`text-sm font-medium text-indigo-700 dark:text-indigo-400 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.projectedCost}
            </p>
            <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-200">
              {formatCurrency(data.projectedMonthlyCost)}
            </p>
            <p className={`text-sm text-indigo-600 dark:text-indigo-400 mt-2 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.thisMonth}
            </p>
          </div>
          <TrendingUp className="h-10 w-10 text-indigo-600" />
        </div>
      </Card>

      {/* Savings Opportunities */}
      <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className={`text-sm font-medium text-emerald-700 dark:text-emerald-400 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.savingsOpportunities}
            </p>
            <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-200">
              {formatCurrency(data.savingsOpportunities)}
            </p>
            <p className={`text-sm text-emerald-600 dark:text-emerald-400 mt-2 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.potential}
            </p>
          </div>
          <AlertTriangle className="h-10 w-10 text-emerald-600" />
        </div>
      </Card>

      {/* Top Cost Drivers */}
      <Card className="p-6 md:col-span-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h3 className={`text-lg font-semibold text-gray-900 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
            {isRTL ? 'أهم محركات التكلفة' : 'Top Cost Drivers'}
          </h3>
          <BarChart3 className="h-5 w-5 text-gray-500" />
        </div>
        
        <div className="space-y-4">
          {data.topCostDrivers.map((driver, index) => (
            <div key={index} className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                <p className={`font-medium text-gray-900 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                  {isRTL ? driver.categoryArabic : driver.category}
                </p>
                <div className={`flex items-center gap-2 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(driver.cost)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({driver.percentage.toFixed(1)}%)
                  </span>
                  {getTrendIcon(driver.changePercentage)}
                  <span className={`text-sm ${getTrendColor(driver.changePercentage)}`}>
                    {Math.abs(driver.changePercentage).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-saudi-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${driver.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default CostOverviewCards;