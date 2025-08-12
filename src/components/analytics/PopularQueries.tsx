'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, MessageSquare, Hash, Clock, User, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PopularQuery {
  id: string;
  query: string;
  queryArabic: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  avgResponseTime: number;
  category: string;
  categoryArabic: string;
  lastAsked: string;
  uniqueUsers: number;
  successRate: number;
}

interface PopularTopic {
  id: string;
  topic: string;
  topicArabic: string;
  count: number;
  percentage: number;
  queries: string[];
  category: string;
  categoryArabic: string;
}

interface PopularQueriesProps {
  language?: 'ar' | 'en';
  className?: string;
}

const PopularQueries: React.FC<PopularQueriesProps> = ({
  language = 'ar',
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'queries' | 'topics'>('queries');
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [queries, setQueries] = useState<PopularQuery[]>([]);
  const [topics, setTopics] = useState<PopularTopic[]>([]);

  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'الاستفسارات والمواضيع الشائعة',
    subtitle: 'تحليل للاستفسارات الأكثر طلباً والمواضيع الأكثر بحثاً',
    popularQueries: 'الاستفسارات الشائعة',
    popularTopics: 'المواضيع الشائعة',
    today: 'اليوم',
    thisWeek: 'هذا الأسبوع',
    thisMonth: 'هذا الشهر',
    queryText: 'نص الاستفسار',
    frequency: 'التكرار',
    trend: 'الاتجاه',
    responseTime: 'زمن الاستجابة',
    successRate: 'معدل النجاح',
    category: 'الفئة',
    lastAsked: 'آخر استفسار',
    uniqueUsers: 'مستخدمون فريدون',
    viewAll: 'عرض الكل',
    noData: 'لا توجد بيانات متاحة',
    loading: 'جاري التحميل...',
    seconds: 'ثانية',
    minutes: 'دقيقة',
    hours: 'ساعة',
    days: 'أيام',
    ago: 'مضى',
    relatedQueries: 'استفسارات مرتبطة'
  } : {
    title: 'Popular Queries & Topics',
    subtitle: 'Analysis of most requested queries and searched topics',
    popularQueries: 'Popular Queries',
    popularTopics: 'Popular Topics',
    today: 'Today',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    queryText: 'Query Text',
    frequency: 'Frequency',
    trend: 'Trend',
    responseTime: 'Response Time',
    successRate: 'Success Rate',
    category: 'Category',
    lastAsked: 'Last Asked',
    uniqueUsers: 'Unique Users',
    viewAll: 'View All',
    noData: 'No data available',
    loading: 'Loading...',
    seconds: 'sec',
    minutes: 'min',
    hours: 'hrs',
    days: 'days',
    ago: 'ago',
    relatedQueries: 'Related Queries'
  };

  // Mock data - In real app, this would come from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockQueries: PopularQuery[] = [
        {
          id: '1',
          query: 'What are the working hours regulations in Saudi Arabia?',
          queryArabic: 'ما هي أنظمة ساعات العمل في المملكة العربية السعودية؟',
          count: 1247,
          percentage: 18.5,
          trend: 'up',
          trendPercentage: 12.3,
          avgResponseTime: 2.1,
          category: 'Working Hours',
          categoryArabic: 'ساعات العمل',
          lastAsked: '2024-01-12T10:30:00Z',
          uniqueUsers: 156,
          successRate: 97.8
        },
        {
          id: '2',
          query: 'Annual leave entitlement for employees',
          queryArabic: 'استحقاق الإجازة السنوية للموظفين',
          count: 1089,
          percentage: 16.1,
          trend: 'up',
          trendPercentage: 8.7,
          avgResponseTime: 1.8,
          category: 'Leave Policy',
          categoryArabic: 'سياسة الإجازات',
          lastAsked: '2024-01-12T11:15:00Z',
          uniqueUsers: 142,
          successRate: 95.4
        },
        {
          id: '3',
          query: 'Termination procedures and notice periods',
          queryArabic: 'إجراءات إنهاء الخدمة وفترات الإشعار',
          count: 956,
          percentage: 14.2,
          trend: 'stable',
          trendPercentage: 1.2,
          avgResponseTime: 2.8,
          category: 'Termination',
          categoryArabic: 'إنهاء الخدمة',
          lastAsked: '2024-01-12T09:45:00Z',
          uniqueUsers: 128,
          successRate: 93.1
        },
        {
          id: '4',
          query: 'Maternity leave rights and benefits',
          queryArabic: 'حقوق ومزايا إجازة الأمومة',
          count: 823,
          percentage: 12.2,
          trend: 'up',
          trendPercentage: 15.6,
          avgResponseTime: 2.3,
          category: 'Benefits',
          categoryArabic: 'المزايا',
          lastAsked: '2024-01-12T08:20:00Z',
          uniqueUsers: 97,
          successRate: 98.2
        },
        {
          id: '5',
          query: 'Overtime compensation calculations',
          queryArabic: 'حسابات تعويض العمل الإضافي',
          count: 734,
          percentage: 10.9,
          trend: 'down',
          trendPercentage: -5.3,
          avgResponseTime: 3.1,
          category: 'Compensation',
          categoryArabic: 'التعويضات',
          lastAsked: '2024-01-12T12:00:00Z',
          uniqueUsers: 89,
          successRate: 91.7
        },
        {
          id: '6',
          query: 'Workplace safety regulations',
          queryArabic: 'أنظمة السلامة في مكان العمل',
          count: 645,
          percentage: 9.6,
          trend: 'up',
          trendPercentage: 22.1,
          avgResponseTime: 2.7,
          category: 'Safety',
          categoryArabic: 'السلامة',
          lastAsked: '2024-01-12T14:30:00Z',
          uniqueUsers: 76,
          successRate: 94.8
        }
      ];

      const mockTopics: PopularTopic[] = [
        {
          id: '1',
          topic: 'Employment Contracts',
          topicArabic: 'عقود العمل',
          count: 2341,
          percentage: 28.7,
          queries: ['Contract types', 'Contract duration', 'Contract amendments'],
          category: 'Legal',
          categoryArabic: 'قانوني'
        },
        {
          id: '2',
          topic: 'Leave Policies',
          topicArabic: 'سياسات الإجازات',
          count: 1987,
          percentage: 24.3,
          queries: ['Annual leave', 'Sick leave', 'Emergency leave'],
          category: 'HR Policy',
          categoryArabic: 'سياسة الموارد البشرية'
        },
        {
          id: '3',
          topic: 'Wages and Benefits',
          topicArabic: 'الأجور والمزايا',
          count: 1654,
          percentage: 20.2,
          queries: ['Salary calculations', 'Bonus structures', 'End of service benefits'],
          category: 'Compensation',
          categoryArabic: 'التعويضات'
        },
        {
          id: '4',
          topic: 'Workplace Rights',
          topicArabic: 'حقوق مكان العمل',
          count: 1432,
          percentage: 17.5,
          queries: ['Employee rights', 'Discrimination policies', 'Grievance procedures'],
          category: 'Rights',
          categoryArabic: 'الحقوق'
        },
        {
          id: '5',
          topic: 'Disciplinary Actions',
          topicArabic: 'الإجراءات التأديبية',
          count: 756,
          percentage: 9.3,
          queries: ['Warning procedures', 'Disciplinary measures', 'Appeal processes'],
          category: 'Discipline',
          categoryArabic: 'النظام'
        }
      ];

      setQueries(mockQueries);
      setTopics(mockTopics);
      setLoading(false);
    };

    fetchData();
  }, [timeRange]);

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} ${labels.seconds} ${labels.ago}`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${labels.minutes} ${labels.ago}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${labels.hours} ${labels.ago}`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${labels.days} ${labels.ago}`;
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: string, percentage: number) => {
    switch (trend) {
      case 'up':
        return (
          <div className="flex items-center gap-1 text-green-600">
            <ArrowUp className="h-3 w-3" />
            <span className="text-xs">+{percentage.toFixed(1)}%</span>
          </div>
        );
      case 'down':
        return (
          <div className="flex items-center gap-1 text-red-600">
            <ArrowDown className="h-3 w-3" />
            <span className="text-xs">{percentage.toFixed(1)}%</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 text-gray-500">
            <Minus className="h-3 w-3" />
            <span className="text-xs">0%</span>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* Header */}
      <div className={`mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
        <h3 className={`text-lg font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
          {labels.title}
        </h3>
        <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
          {labels.subtitle}
        </p>
      </div>

      {/* Controls */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        {/* Tab Selection */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('queries')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'queries'
                ? 'bg-white dark:bg-gray-600 text-saudi-navy-800 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            } ${isRTL ? 'font-arabic' : ''}`}
          >
            {labels.popularQueries}
          </button>
          <button
            onClick={() => setActiveTab('topics')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'topics'
                ? 'bg-white dark:bg-gray-600 text-saudi-navy-800 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            } ${isRTL ? 'font-arabic' : ''}`}
          >
            {labels.popularTopics}
          </button>
        </div>

        {/* Time Range Selection */}
        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {['day', 'week', 'month'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range as 'day' | 'week' | 'month')}
              className={`${isRTL ? 'font-arabic' : ''}`}
            >
              {range === 'day' ? labels.today : range === 'week' ? labels.thisWeek : labels.thisMonth}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'queries' ? (
        <div className="space-y-4">
          {queries.map((query, index) => (
            <div
              key={query.id}
              className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center justify-center w-8 h-8 bg-saudi-navy-100 dark:bg-saudi-navy-900 rounded-full text-sm font-medium text-saudi-navy-800 dark:text-saudi-navy-200 ${isRTL ? 'ml-3' : 'mr-3'}`}>
                    {index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <p className={`font-medium text-gray-900 dark:text-white mb-1 ${isRTL ? 'font-arabic' : ''}`}>
                      {isRTL ? query.queryArabic : query.query}
                    </p>
                    
                    <div className={`flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Hash className="h-3 w-3" />
                        <span className={isRTL ? 'font-arabic' : ''}>
                          {new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US').format(query.count)} ({query.percentage}%)
                        </span>
                      </div>
                      
                      <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Clock className="h-3 w-3" />
                        <span>{query.avgResponseTime}s</span>
                      </div>
                      
                      <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <User className="h-3 w-3" />
                        <span className={isRTL ? 'font-arabic' : ''}>
                          {new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US').format(query.uniqueUsers)}
                        </span>
                      </div>
                      
                      <Badge variant="outline" className={`text-xs ${isRTL ? 'font-arabic' : ''}`}>
                        {isRTL ? query.categoryArabic : query.category}
                      </Badge>
                      
                      <span className={`text-xs ${isRTL ? 'font-arabic' : ''}`}>
                        {formatTimeAgo(query.lastAsked)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`flex flex-col items-end gap-2 ${isRTL ? 'items-start' : 'items-end'}`}>
                {getTrendIcon(query.trend, query.trendPercentage)}
                <div className="text-xs text-gray-500">
                  {query.successRate}% {isRTL ? 'نجاح' : 'success'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map((topic, index) => (
            <div
              key={topic.id}
              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className={`flex items-start justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center justify-center w-8 h-8 bg-saudi-green-100 dark:bg-saudi-green-900 rounded-full text-sm font-medium text-saudi-green-800 dark:text-saudi-green-200`}>
                    {index + 1}
                  </div>
                  
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <h4 className={`font-medium text-gray-900 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                      {isRTL ? topic.topicArabic : topic.topic}
                    </h4>
                    <div className={`flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className={isRTL ? 'font-arabic' : ''}>
                        {new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US').format(topic.count)} {labels.frequency}
                      </span>
                      <Badge variant="secondary" className={`text-xs ${isRTL ? 'font-arabic' : ''}`}>
                        {isRTL ? topic.categoryArabic : topic.category}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-saudi-green-600">
                    {topic.percentage}%
                  </div>
                </div>
              </div>
              
              <div className={`${isRTL ? 'text-right' : 'text-left'}`}>
                <p className={`text-xs text-gray-500 dark:text-gray-400 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
                  {labels.relatedQueries}:
                </p>
                <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {topic.queries.map((query, queryIndex) => (
                    <Badge
                      key={queryIndex}
                      variant="outline"
                      className={`text-xs ${isRTL ? 'font-arabic' : ''}`}
                    >
                      {query}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={`mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
        <Button variant="outline" size="sm" className={isRTL ? 'font-arabic' : ''}>
          <TrendingUp className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {labels.viewAll}
        </Button>
      </div>
    </div>
  );
};

export default PopularQueries;