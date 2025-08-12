'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { CostMetrics, ModelCostBreakdown } from '@/types/analytics';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';

interface CostBreakdownProps {
  data: CostMetrics;
  currency?: 'USD' | 'SAR';
  language?: 'ar' | 'en';
  className?: string;
}

const CostBreakdown: React.FC<CostBreakdownProps> = ({
  data,
  currency = 'USD',
  language = 'ar',
  className = '',
}) => {
  const isRTL = language === 'ar';
  const exchangeRate = currency === 'SAR' ? 3.75 : 1; // USD to SAR

  // Format currency
  const formatCurrency = (amount: number) => {
    const converted = amount * exchangeRate;
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(converted);
  };

  // Colors for pie chart
  const pieColors = [
    '#1a365d', // saudi-navy-800
    '#0f7b0f', // saudi-green-900  
    '#744210', // saudi-gold-900
    '#486581', // saudi-navy-600
    '#38a169', // saudi-green-600
    '#d69e2e', // saudi-gold-600
  ];

  const labels = isRTL ? {
    totalCost: 'إجمالي التكلفة',
    monthlyCost: 'التكلفة الشهرية',
    costPerUser: 'التكلفة لكل مستخدم',
    costPerMessage: 'التكلفة لكل رسالة',
    budgetUtilization: 'استخدام الميزانية',
    modelBreakdown: 'توزيع التكلفة حسب النموذج',
    costTrend: 'اتجاه التكلفة',
    projectedCost: 'التكلفة المتوقعة',
    remainingBudget: 'الميزانية المتبقية',
    budgetStatus: 'حالة الميزانية',
    dailyCosts: 'التكاليف اليومية',
    tokensUsed: 'الرموز المستخدمة',
    averageResponseTime: 'متوسط زمن الاستجابة',
  } : {
    totalCost: 'Total Cost',
    monthlyCost: 'Monthly Cost',
    costPerUser: 'Cost per User',
    costPerMessage: 'Cost per Message',
    budgetUtilization: 'Budget Utilization',
    modelBreakdown: 'Cost Breakdown by Model',
    costTrend: 'Cost Trend',
    projectedCost: 'Projected Cost',
    remainingBudget: 'Remaining Budget',
    budgetStatus: 'Budget Status',
    dailyCosts: 'Daily Costs',
    tokensUsed: 'Tokens Used',
    averageResponseTime: 'Avg Response Time',
  };

  // Prepare pie chart data
  const pieData = data.modelBreakdown.map((model, index) => ({
    name: model.modelName,
    value: model.cost * exchangeRate,
    percentage: model.percentage,
    tokensUsed: model.tokensUsed,
    responseTime: model.averageResponseTime,
    fill: pieColors[index % pieColors.length],
  }));

  // Prepare cost trend data
  const costTrendData = data.dailyCost.map(day => ({
    date: day.date,
    formattedDate: format(new Date(day.date), 'MMM dd', { locale: isRTL ? ar : undefined }),
    cost: day.cost * exchangeRate,
    tokensUsed: day.tokensUsed,
    messages: day.messagesProcessed,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className={`text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className={`text-sm ${isRTL ? 'font-arabic' : ''}`} style={{ color: entry.color }}>
              {entry.name === 'cost' 
                ? `${labels.dailyCosts}: ${formatCurrency(entry.value / exchangeRate)}`
                : `${entry.name}: ${entry.value.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}`
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className={`text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
            {data.name}
          </p>
          <p className={`text-sm ${isRTL ? 'font-arabic' : ''}`}>
            {labels.totalCost}: {formatCurrency(data.value / exchangeRate)}
          </p>
          <p className={`text-sm ${isRTL ? 'font-arabic' : ''}`}>
            {isRTL ? 'النسبة' : 'Percentage'}: {data.percentage}%
          </p>
          <p className={`text-sm ${isRTL ? 'font-arabic' : ''}`}>
            {labels.tokensUsed}: {data.tokensUsed.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
          </p>
          <p className={`text-sm ${isRTL ? 'font-arabic' : ''}`}>
            {labels.averageResponseTime}: {data.responseTime}s
          </p>
        </div>
      );
    }
    return null;
  };

  // Budget status
  const budgetStatus = data.budgetUtilization;
  const isOverBudget = budgetStatus.utilizationPercentage > 100;
  const isNearBudget = budgetStatus.utilizationPercentage > 80;

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Header */}
      <div className={`${isRTL ? 'text-right' : 'text-left'}`}>
        <h3 className={`text-lg font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
          {labels.modelBreakdown}
        </h3>
        <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
          {isRTL ? 'تحليل مفصل لتكاليف استخدام نماذج الذكاء الاصطناعي' : 'Detailed analysis of AI model usage costs'}
        </p>
      </div>

      {/* Cost Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.totalCost}
              </p>
              <p className="text-2xl font-bold text-saudi-navy-800 dark:text-white">
                {formatCurrency(data.totalCost)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-saudi-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.costPerUser}
              </p>
              <p className="text-2xl font-bold text-saudi-navy-800 dark:text-white">
                {formatCurrency(data.costPerUser)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-saudi-gold-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.projectedCost}
              </p>
              <p className="text-2xl font-bold text-saudi-navy-800 dark:text-white">
                {formatCurrency(data.projectedMonthlyCost)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-saudi-navy-600" />
          </div>
        </div>

        <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border ${
          isOverBudget 
            ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' 
            : isNearBudget 
            ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
            : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
        }`}>
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.budgetUtilization}
              </p>
              <p className="text-2xl font-bold text-saudi-navy-800 dark:text-white">
                {Math.round(budgetStatus.utilizationPercentage)}%
              </p>
            </div>
            {isOverBudget ? (
              <AlertTriangle className="h-8 w-8 text-red-600" />
            ) : isNearBudget ? (
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-green-600" />
            )}
          </div>
          <div className="mt-2">
            <div className={`text-xs ${isRTL ? 'font-arabic text-right' : 'text-left'} text-gray-600 dark:text-gray-400`}>
              {labels.remainingBudget}: {formatCurrency(budgetStatus.remainingBudget)}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Cost Breakdown Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.modelBreakdown}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={(entry) => `${entry.name} (${entry.percentage}%)`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Trend Line Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.costTrend}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={costTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                reversed={isRTL}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                orientation={isRTL ? 'right' : 'left'}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#1a365d"
                strokeWidth={2}
                dot={{ fill: '#1a365d', r: 4 }}
                name={labels.dailyCosts}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model Performance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {isRTL ? 'أداء النماذج وتكلفتها' : 'Model Performance & Costs'}
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr className={isRTL ? 'text-right' : 'text-left'}>
                <th className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'font-arabic' : ''}`}>
                  {isRTL ? 'النموذج' : 'Model'}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'font-arabic' : ''}`}>
                  {isRTL ? 'المزود' : 'Provider'}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'font-arabic' : ''}`}>
                  {labels.tokensUsed}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'font-arabic' : ''}`}>
                  {labels.totalCost}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'font-arabic' : ''}`}>
                  {isRTL ? 'النسبة' : 'Share'}
                </th>
                <th className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${isRTL ? 'font-arabic' : ''}`}>
                  {labels.averageResponseTime}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {data.modelBreakdown.map((model, index) => (
                <tr key={index} className={isRTL ? 'text-right' : 'text-left'}>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                    {model.modelName}
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize ${isRTL ? 'font-arabic' : ''}`}>
                    {model.provider}
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                    {model.tokensUsed.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                    {formatCurrency(model.cost)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <div className={`w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 ${isRTL ? 'ml-2' : 'mr-2'}`}>
                        <div
                          className="bg-saudi-green-600 h-2 rounded-full"
                          style={{ width: `${model.percentage}%` }}
                        />
                      </div>
                      <span className={`text-xs ${isRTL ? 'font-arabic' : ''}`}>{model.percentage}%</span>
                    </div>
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                    {model.averageResponseTime}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CostBreakdown;