'use client';

import React from 'react';
import { ActivityMetrics, HeatmapData } from '@/types/analytics';
import { format, startOfWeek, addDays, getHours } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Users, Clock, TrendingUp, Eye } from 'lucide-react';

interface UserActivityHeatmapProps {
  data: ActivityMetrics;
  language?: 'ar' | 'en';
  className?: string;
}

const UserActivityHeatmap: React.FC<UserActivityHeatmapProps> = ({
  data,
  language = 'ar',
  className = '',
}) => {
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    activityHeatmap: 'خريطة النشاط الحرارية',
    userActivity: 'نشاط المستخدمين',
    activityPatterns: 'أنماط النشاط على مدار الأسبوع',
    totalUsers: 'إجمالي المستخدمين',
    activeUsers: 'المستخدمون النشطون',
    newUsers: 'مستخدمون جدد',
    engagementRate: 'معدل المشاركة',
    dailyActive: 'نشط يومياً',
    weeklyActive: 'نشط أسبوعياً',
    monthlyActive: 'نشط شهرياً',
    sessionDuration: 'مدة الجلسة',
    actionsPerSession: 'الإجراءات لكل جلسة',
    retentionRate: 'معدل الاحتفاظ',
    departmentActivity: 'نشاط الأقسام',
    topFeatures: 'الميزات الأكثر استخداماً',
    hours: 'الساعات',
    days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    low: 'منخفض',
    medium: 'متوسط',
    high: 'مرتفع',
    veryHigh: 'مرتفع جداً',
    minutes: 'دقيقة',
    actions: 'إجراء',
    adoption: 'معدل التبني',
  } : {
    activityHeatmap: 'User Activity Heatmap',
    userActivity: 'User Activity',
    activityPatterns: 'Activity patterns throughout the week',
    totalUsers: 'Total Users',
    activeUsers: 'Active Users',
    newUsers: 'New Users',
    engagementRate: 'Engagement Rate',
    dailyActive: 'Daily Active',
    weeklyActive: 'Weekly Active',
    monthlyActive: 'Monthly Active',
    sessionDuration: 'Session Duration',
    actionsPerSession: 'Actions per Session',
    retentionRate: 'Retention Rate',
    departmentActivity: 'Department Activity',
    topFeatures: 'Top Features',
    hours: 'Hours',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    veryHigh: 'Very High',
    minutes: 'min',
    actions: 'actions',
    adoption: 'Adoption Rate',
  };

  // Generate mock heatmap data for demonstration
  const generateHeatmapData = (): HeatmapData[][] => {
    const heatmapData: HeatmapData[][] = [];
    
    for (let day = 0; day < 7; day++) {
      const dayData: HeatmapData[] = [];
      for (let hour = 0; hour < 24; hour++) {
        // Higher activity during work hours (8-18) and lower on weekends
        let baseActivity = 10;
        if (day >= 1 && day <= 5) { // Weekdays
          if (hour >= 8 && hour <= 18) {
            baseActivity = 80;
          } else if (hour >= 19 && hour <= 22) {
            baseActivity = 40;
          }
        } else { // Weekends
          if (hour >= 10 && hour <= 14) {
            baseActivity = 30;
          }
        }
        
        const randomVariation = Math.random() * 30 - 15;
        const value = Math.max(0, Math.min(100, baseActivity + randomVariation));
        
        dayData.push({
          day: labels.days[day],
          hour,
          value: Math.round(value),
          intensity: Math.round(value / 25), // 0-4 intensity scale
        });
      }
      heatmapData.push(dayData);
    }
    
    return heatmapData;
  };

  const heatmapData = generateHeatmapData();

  // Color intensity based on activity level
  const getHeatmapColor = (intensity: number) => {
    const colors = [
      'bg-gray-100 dark:bg-gray-800', // 0 - Very low
      'bg-saudi-green-100 dark:bg-saudi-green-900/30', // 1 - Low
      'bg-saudi-green-300 dark:bg-saudi-green-700/50', // 2 - Medium
      'bg-saudi-green-500 dark:bg-saudi-green-600/70', // 3 - High
      'bg-saudi-green-700 dark:bg-saudi-green-500/90', // 4 - Very High
    ];
    return colors[Math.min(intensity, 4)];
  };

  const getIntensityLabel = (intensity: number) => {
    switch (intensity) {
      case 0: return labels.low;
      case 1: return labels.low;
      case 2: return labels.medium;
      case 3: return labels.high;
      case 4: return labels.veryHigh;
      default: return labels.low;
    }
  };

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Header */}
      <div className={isRTL ? 'text-right' : 'text-left'}>
        <h3 className={`text-lg font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
          {labels.activityHeatmap}
        </h3>
        <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
          {labels.activityPatterns}
        </p>
      </div>

      {/* User Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.totalUsers}
              </p>
              <p className="text-2xl font-bold text-saudi-navy-800 dark:text-white">
                {data.totalUsers.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
              </p>
              <p className={`text-xs text-green-600 dark:text-green-400 ${isRTL ? 'font-arabic' : ''}`}>
                +{data.newUsers} {isRTL ? 'جديد' : 'new'}
              </p>
            </div>
            <Users className="h-8 w-8 text-saudi-navy-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.activeUsers}
              </p>
              <p className="text-2xl font-bold text-saudi-green-600">
                {data.activeUsers.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
              </p>
              <p className={`text-xs text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {Math.round((data.activeUsers / data.totalUsers) * 100)}% {isRTL ? 'نسبة النشاط' : 'active rate'}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-saudi-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.sessionDuration}
              </p>
              <p className="text-2xl font-bold text-saudi-gold-600">
                {data.userEngagement.averageSessionDuration.toFixed(1)}
              </p>
              <p className={`text-xs text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.minutes}
              </p>
            </div>
            <Clock className="h-8 w-8 text-saudi-gold-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.retentionRate}
              </p>
              <p className="text-2xl font-bold text-saudi-navy-600">
                {data.userEngagement.retentionRate.toFixed(1)}%
              </p>
            </div>
            <Eye className="h-8 w-8 text-saudi-navy-600" />
          </div>
        </div>
      </div>

      {/* Heatmap Visualization */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
          {labels.activityPatterns}
        </h4>
        
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Time labels */}
            <div className={`flex mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`w-16 ${isRTL ? 'ml-2' : 'mr-2'}`}></div>
              <div className="flex space-x-1">
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className={`w-8 h-6 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                    {hour}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap grid */}
            {heatmapData.map((dayData, dayIndex) => (
              <div key={dayIndex} className={`flex mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`w-16 ${isRTL ? 'ml-2 text-right' : 'mr-2 text-left'} flex items-center`}>
                  <span className={`text-xs font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                    {dayData[0].day}
                  </span>
                </div>
                <div className="flex space-x-1">
                  {dayData.map((hourData, hourIndex) => (
                    <div
                      key={hourIndex}
                      className={`w-8 h-8 rounded-sm cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg ${getHeatmapColor(hourData.intensity)}`}
                      title={`${hourData.day} ${hourData.hour}:00 - ${getIntensityLabel(hourData.intensity)} (${hourData.value}%)`}
                    />
                  ))}
                </div>
              </div>
            ))}
            
            {/* Legend */}
            <div className={`mt-4 flex items-center justify-center space-x-4 ${isRTL ? 'space-x-reverse' : ''}`}>
              <span className={`text-xs text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.low}
              </span>
              <div className="flex space-x-1">
                {[0, 1, 2, 3, 4].map((intensity) => (
                  <div
                    key={intensity}
                    className={`w-4 h-4 rounded-sm ${getHeatmapColor(intensity)}`}
                  />
                ))}
              </div>
              <span className={`text-xs text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.veryHigh}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
          {labels.engagementRate}
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className={`text-sm text-gray-600 dark:text-gray-400 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.dailyActive}
            </p>
            <p className="text-xl font-bold text-saudi-green-600">
              {data.userEngagement.dailyActiveUsers.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            </p>
            <div className="mt-2 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className="bg-saudi-green-600 h-2 rounded-full"
                style={{ width: `${(data.userEngagement.dailyActiveUsers / data.totalUsers) * 100}%` }}
              />
            </div>
          </div>

          <div className={`text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className={`text-sm text-gray-600 dark:text-gray-400 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.weeklyActive}
            </p>
            <p className="text-xl font-bold text-saudi-navy-600">
              {data.userEngagement.weeklyActiveUsers.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            </p>
            <div className="mt-2 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className="bg-saudi-navy-600 h-2 rounded-full"
                style={{ width: `${(data.userEngagement.weeklyActiveUsers / data.totalUsers) * 100}%` }}
              />
            </div>
          </div>

          <div className={`text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className={`text-sm text-gray-600 dark:text-gray-400 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.monthlyActive}
            </p>
            <p className="text-xl font-bold text-saudi-gold-600">
              {data.userEngagement.monthlyActiveUsers.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            </p>
            <div className="mt-2 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className="bg-saudi-gold-600 h-2 rounded-full"
                style={{ width: `${(data.userEngagement.monthlyActiveUsers / data.totalUsers) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Department Activity and Top Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.departmentActivity}
          </h4>
          
          <div className="space-y-3">
            {data.departmentActivity.map((dept, index) => (
              <div key={index} className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <p className={`text-sm font-medium text-gray-900 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                    {isRTL ? dept.departmentArabic : dept.department}
                  </p>
                  <p className={`text-xs text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                    {dept.activeUsers}/{dept.totalUsers} {isRTL ? 'نشط' : 'active'}
                  </p>
                </div>
                <div className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse' : ''}`}>
                  <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-saudi-green-600 h-2 rounded-full"
                      style={{ width: `${(dept.activeUsers / dept.totalUsers) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-saudi-navy-600">
                    {Math.round((dept.activeUsers / dept.totalUsers) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Features */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.topFeatures}
          </h4>
          
          <div className="space-y-3">
            {data.topFeatures.map((feature, index) => (
              <div key={index} className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <p className={`text-sm font-medium text-gray-900 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                    {isRTL ? feature.featureNameArabic : feature.featureName}
                  </p>
                  <p className={`text-xs text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                    {feature.usageCount.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'استخدام' : 'uses'}
                  </p>
                </div>
                <div className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse' : ''}`}>
                  <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-saudi-gold-600 h-2 rounded-full"
                      style={{ width: `${feature.adoptionRate}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-saudi-gold-600">
                    {feature.adoptionRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserActivityHeatmap;