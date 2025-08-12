'use client';

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { UsageMetrics, DailyUsage } from '@/types/analytics';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface UsageChartProps {
  data: UsageMetrics;
  chartType?: 'line' | 'area' | 'bar';
  height?: number;
  showLegend?: boolean;
  language?: 'ar' | 'en';
  className?: string;
}

const UsageChart: React.FC<UsageChartProps> = ({
  data,
  chartType = 'line',
  height = 400,
  showLegend = true,
  language = 'ar',
  className = '',
}) => {
  const isRTL = language === 'ar';

  // Prepare chart data
  const chartData = data.dailyUsage.map((day) => ({
    date: day.date,
    formattedDate: format(new Date(day.date), 'MMM dd', { locale: isRTL ? ar : undefined }),
    messages: day.messages,
    documents: day.documents,
    templates: day.templates,
    apiCalls: day.apiCalls,
    activeUsers: day.activeUsers,
  }));

  // Chart colors using Saudi theme
  const colors = {
    messages: '#1a365d', // saudi-navy-800
    documents: '#0f7b0f', // saudi-green-900
    templates: '#744210', // saudi-gold-900
    apiCalls: '#486581', // saudi-navy-600
    activeUsers: '#38a169', // saudi-green-600
  };

  const labels = isRTL ? {
    messages: 'الرسائل',
    documents: 'المستندات',
    templates: 'القوالب',
    apiCalls: 'استدعاءات API',
    activeUsers: 'المستخدمون النشطون',
  } : {
    messages: 'Messages',
    documents: 'Documents',
    templates: 'Templates',
    apiCalls: 'API Calls',
    activeUsers: 'Active Users',
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className={`text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
            {format(new Date(label), isRTL ? 'dd MMMM yyyy' : 'MMM dd, yyyy', { locale: isRTL ? ar : undefined })}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className={`text-sm ${isRTL ? 'font-arabic' : ''}`} style={{ color: entry.color }}>
              {`${labels[entry.dataKey as keyof typeof labels]}: ${entry.value.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    const chartComponents = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="formattedDate"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={{ stroke: '#d1d5db' }}
          axisLine={{ stroke: '#d1d5db' }}
          reversed={isRTL}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={{ stroke: '#d1d5db' }}
          axisLine={{ stroke: '#d1d5db' }}
          orientation={isRTL ? 'right' : 'left'}
        />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && (
          <Legend
            wrapperStyle={{
              fontSize: '12px',
              fontFamily: isRTL ? 'Noto Sans Arabic, sans-serif' : 'inherit',
            }}
            iconType="circle"
          />
        )}
      </>
    );

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {chartComponents}
            <Area
              type="monotone"
              dataKey="messages"
              stackId="1"
              stroke={colors.messages}
              fill={colors.messages}
              fillOpacity={0.6}
              name={labels.messages}
            />
            <Area
              type="monotone"
              dataKey="documents"
              stackId="1"
              stroke={colors.documents}
              fill={colors.documents}
              fillOpacity={0.6}
              name={labels.documents}
            />
            <Area
              type="monotone"
              dataKey="templates"
              stackId="1"
              stroke={colors.templates}
              fill={colors.templates}
              fillOpacity={0.6}
              name={labels.templates}
            />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {chartComponents}
            <Bar dataKey="messages" fill={colors.messages} name={labels.messages} />
            <Bar dataKey="documents" fill={colors.documents} name={labels.documents} />
            <Bar dataKey="templates" fill={colors.templates} name={labels.templates} />
          </BarChart>
        );
      
      default: // line
        return (
          <LineChart {...commonProps}>
            {chartComponents}
            <Line
              type="monotone"
              dataKey="messages"
              stroke={colors.messages}
              strokeWidth={2}
              dot={{ fill: colors.messages, r: 4 }}
              name={labels.messages}
            />
            <Line
              type="monotone"
              dataKey="documents"
              stroke={colors.documents}
              strokeWidth={2}
              dot={{ fill: colors.documents, r: 4 }}
              name={labels.documents}
            />
            <Line
              type="monotone"
              dataKey="templates"
              stroke={colors.templates}
              strokeWidth={2}
              dot={{ fill: colors.templates, r: 4 }}
              name={labels.templates}
            />
            <Line
              type="monotone"
              dataKey="activeUsers"
              stroke={colors.activeUsers}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: colors.activeUsers, r: 4 }}
              name={labels.activeUsers}
            />
          </LineChart>
        );
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className={`mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
        <h3 className={`text-lg font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
          {isRTL ? 'إحصائيات الاستخدام' : 'Usage Statistics'}
        </h3>
        <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
          {isRTL ? 'نظرة عامة على استخدام النظام عبر الوقت' : 'Overview of system usage over time'}
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Usage Summary Cards */}
      <div className={`mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 ${isRTL ? 'text-right' : 'text-left'}`}>
        <div className="bg-saudi-navy-50 dark:bg-saudi-navy-900/20 rounded-lg p-3 border border-saudi-navy-200 dark:border-saudi-navy-700">
          <div className="text-2xl font-bold text-saudi-navy-800 dark:text-saudi-navy-200">
            {data.totalMessages.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
          </div>
          <div className={`text-sm text-saudi-navy-600 dark:text-saudi-navy-400 ${isRTL ? 'font-arabic' : ''}`}>
            {labels.messages}
          </div>
        </div>

        <div className="bg-saudi-green-50 dark:bg-saudi-green-900/20 rounded-lg p-3 border border-saudi-green-200 dark:border-saudi-green-700">
          <div className="text-2xl font-bold text-saudi-green-800 dark:text-saudi-green-200">
            {data.totalDocuments.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
          </div>
          <div className={`text-sm text-saudi-green-600 dark:text-saudi-green-400 ${isRTL ? 'font-arabic' : ''}`}>
            {labels.documents}
          </div>
        </div>

        <div className="bg-saudi-gold-50 dark:bg-saudi-gold-900/20 rounded-lg p-3 border border-saudi-gold-200 dark:border-saudi-gold-700">
          <div className="text-2xl font-bold text-saudi-gold-800 dark:text-saudi-gold-200">
            {data.totalTemplatesGenerated.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
          </div>
          <div className={`text-sm text-saudi-gold-600 dark:text-saudi-gold-400 ${isRTL ? 'font-arabic' : ''}`}>
            {labels.templates}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            {data.totalApiCalls.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
          </div>
          <div className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
            {labels.apiCalls}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageChart;