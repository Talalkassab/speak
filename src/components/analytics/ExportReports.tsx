'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  FileText,
  Calendar,
  Clock,
  Mail,
  Settings,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Filter,
  Share2,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  Printer
} from 'lucide-react';
import { AnalyticsMetrics, TimeRange, ExportOptions, ExportProgress } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ScheduledReport {
  id: string;
  name: string;
  nameArabic: string;
  format: 'csv' | 'excel' | 'pdf';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  metrics: string[];
  includeCharts: boolean;
  includeRawData: boolean;
  nextRun: string;
  lastRun?: string;
  status: 'active' | 'paused' | 'failed';
  createdAt: string;
}

interface ExportReportsProps {
  data: AnalyticsMetrics | null;
  language?: 'ar' | 'en';
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  className?: string;
}

const ExportReports: React.FC<ExportReportsProps> = ({
  data,
  language = 'ar',
  timeRange,
  onTimeRangeChange,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'scheduled' | 'history'>('export');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['usage', 'cost', 'performance']);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeRawData, setIncludeRawData] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'التقارير والتصدير',
    subtitle: 'تصدير البيانات التحليلية وجدولة التقارير الآلية',
    exportData: 'تصدير البيانات',
    scheduledReports: 'التقارير المجدولة',
    exportHistory: 'سجل التصدير',
    quickExport: 'تصدير سريع',
    customExport: 'تصدير مخصص',
    selectMetrics: 'اختيار المقاييس',
    selectTimeRange: 'اختيار النطاق الزمني',
    exportFormat: 'نوع التصدير',
    includeCharts: 'تضمين المخططات',
    includeRawData: 'تضمين البيانات الخام',
    generateReport: 'إنشاء التقرير',
    downloadReport: 'تحميل التقرير',
    scheduleReport: 'جدولة التقرير',
    createScheduled: 'إنشاء تقرير مجدول',
    reportName: 'اسم التقرير',
    frequency: 'التكرار',
    recipients: 'المستلمون',
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    quarterly: 'ربع سنوي',
    csvFormat: 'CSV',
    excelFormat: 'Excel',
    pdfFormat: 'PDF',
    usage: 'الاستخدام',
    cost: 'التكلفة',
    performance: 'الأداء',
    compliance: 'الامتثال',
    activity: 'النشاط',
    allMetrics: 'جميع المقاييس',
    lastWeek: 'الأسبوع الماضي',
    lastMonth: 'الشهر الماضي',
    lastQuarter: 'الربع الماضي',
    lastYear: 'السنة الماضية',
    custom: 'مخصص',
    active: 'نشط',
    paused: 'متوقف',
    failed: 'فشل',
    pending: 'في الانتظار',
    processing: 'قيد المعالجة',
    completed: 'مكتمل',
    error: 'خطأ',
    nextRun: 'التشغيل القادم',
    lastRun: 'آخر تشغيل',
    createdAt: 'تاريخ الإنشاء',
    actions: 'الإجراءات',
    edit: 'تعديل',
    delete: 'حذف',
    pause: 'إيقاف',
    resume: 'استئناف',
    runNow: 'تشغيل الآن',
    noReports: 'لا توجد تقارير مجدولة',
    noHistory: 'لا يوجد سجل تصدير',
    creating: 'جاري الإنشاء...',
    exportStarted: 'بدأ التصدير',
    exportCompleted: 'اكتمل التصدير',
    exportFailed: 'فشل التصدير',
    addRecipient: 'إضافة مستلم',
    emailAddress: 'عنوان البريد الإلكتروني',
    save: 'حفظ',
    cancel: 'إلغاء',
    preview: 'معاينة',
    share: 'مشاركة',
    print: 'طباعة'
  } : {
    title: 'Reports & Export',
    subtitle: 'Export analytics data and schedule automated reports',
    exportData: 'Export Data',
    scheduledReports: 'Scheduled Reports',
    exportHistory: 'Export History',
    quickExport: 'Quick Export',
    customExport: 'Custom Export',
    selectMetrics: 'Select Metrics',
    selectTimeRange: 'Select Time Range',
    exportFormat: 'Export Format',
    includeCharts: 'Include Charts',
    includeRawData: 'Include Raw Data',
    generateReport: 'Generate Report',
    downloadReport: 'Download Report',
    scheduleReport: 'Schedule Report',
    createScheduled: 'Create Scheduled Report',
    reportName: 'Report Name',
    frequency: 'Frequency',
    recipients: 'Recipients',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    csvFormat: 'CSV',
    excelFormat: 'Excel',
    pdfFormat: 'PDF',
    usage: 'Usage',
    cost: 'Cost',
    performance: 'Performance',
    compliance: 'Compliance',
    activity: 'Activity',
    allMetrics: 'All Metrics',
    lastWeek: 'Last Week',
    lastMonth: 'Last Month',
    lastQuarter: 'Last Quarter',
    lastYear: 'Last Year',
    custom: 'Custom',
    active: 'Active',
    paused: 'Paused',
    failed: 'Failed',
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    error: 'Error',
    nextRun: 'Next Run',
    lastRun: 'Last Run',
    createdAt: 'Created',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    pause: 'Pause',
    resume: 'Resume',
    runNow: 'Run Now',
    noReports: 'No scheduled reports',
    noHistory: 'No export history',
    creating: 'Creating...',
    exportStarted: 'Export Started',
    exportCompleted: 'Export Completed',
    exportFailed: 'Export Failed',
    addRecipient: 'Add Recipient',
    emailAddress: 'Email Address',
    save: 'Save',
    cancel: 'Cancel',
    preview: 'Preview',
    share: 'Share',
    print: 'Print'
  };

  // Mock data
  useEffect(() => {
    const mockScheduledReports: ScheduledReport[] = [
      {
        id: '1',
        name: 'Weekly Performance Report',
        nameArabic: 'تقرير الأداء الأسبوعي',
        format: 'pdf',
        frequency: 'weekly',
        recipients: ['hr@company.com', 'admin@company.com'],
        metrics: ['usage', 'performance', 'compliance'],
        includeCharts: true,
        includeRawData: false,
        nextRun: '2024-01-15T09:00:00Z',
        lastRun: '2024-01-08T09:00:00Z',
        status: 'active',
        createdAt: '2024-01-01T10:00:00Z'
      },
      {
        id: '2',
        name: 'Monthly Cost Analysis',
        nameArabic: 'تحليل التكاليف الشهري',
        format: 'excel',
        frequency: 'monthly',
        recipients: ['finance@company.com'],
        metrics: ['cost', 'usage'],
        includeCharts: true,
        includeRawData: true,
        nextRun: '2024-02-01T08:00:00Z',
        lastRun: '2024-01-01T08:00:00Z',
        status: 'active',
        createdAt: '2023-12-15T14:00:00Z'
      },
      {
        id: '3',
        name: 'Daily Usage Summary',
        nameArabic: 'ملخص الاستخدام اليومي',
        format: 'csv',
        frequency: 'daily',
        recipients: ['ops@company.com'],
        metrics: ['usage', 'activity'],
        includeCharts: false,
        includeRawData: true,
        nextRun: '2024-01-13T06:00:00Z',
        status: 'paused',
        createdAt: '2024-01-05T16:00:00Z'
      }
    ];

    const mockExportHistory: ExportProgress[] = [
      {
        id: '1',
        status: 'completed',
        progress: 100,
        downloadUrl: '/downloads/analytics-report-2024-01-12.pdf',
        createdAt: '2024-01-12T14:30:00Z',
        completedAt: '2024-01-12T14:32:00Z'
      },
      {
        id: '2',
        status: 'completed',
        progress: 100,
        downloadUrl: '/downloads/cost-analysis-2024-01-11.xlsx',
        createdAt: '2024-01-11T10:15:00Z',
        completedAt: '2024-01-11T10:18:00Z'
      },
      {
        id: '3',
        status: 'failed',
        progress: 45,
        error: 'Export timeout - please try again with a smaller date range',
        createdAt: '2024-01-10T16:20:00Z'
      }
    ];

    setScheduledReports(mockScheduledReports);
    setExportProgress(mockExportHistory);
  }, []);

  // Handle export
  const handleExport = async () => {
    if (!data) return;

    setIsExporting(true);
    
    const exportId = `export-${Date.now()}`;
    const newExport: ExportProgress = {
      id: exportId,
      status: 'processing',
      progress: 0,
      createdAt: new Date().toISOString()
    };

    setExportProgress(prev => [newExport, ...prev]);

    try {
      // Simulate export process
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setExportProgress(prev => 
          prev.map(exp => exp.id === exportId ? { ...exp, progress } : exp)
        );
      }

      // Complete export
      const completedExport: ExportProgress = {
        ...newExport,
        status: 'completed',
        progress: 100,
        downloadUrl: `/downloads/analytics-${exportFormat}-${Date.now()}.${exportFormat}`,
        completedAt: new Date().toISOString()
      };

      setExportProgress(prev => 
        prev.map(exp => exp.id === exportId ? completedExport : exp)
      );

    } catch (error) {
      setExportProgress(prev => 
        prev.map(exp => exp.id === exportId ? {
          ...exp,
          status: 'failed',
          error: 'Export failed. Please try again.'
        } : exp)
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle metric selection
  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400';
      case 'processing':
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {['export', 'scheduled', 'history'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-600 text-saudi-navy-800 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            } ${isRTL ? 'font-arabic' : ''}`}
          >
            {tab === 'export' ? labels.exportData :
             tab === 'scheduled' ? labels.scheduledReports : labels.exportHistory}
          </button>
        ))}
      </div>

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Export Options */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
              {labels.quickExport}
            </h4>

            <div className="space-y-4">
              {/* Quick Export Buttons */}
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  className={`justify-start ${isRTL ? 'flex-row-reverse font-arabic' : ''}`}
                  onClick={() => {
                    setSelectedMetrics(['usage', 'cost', 'performance', 'compliance', 'activity']);
                    setExportFormat('pdf');
                    setIncludeCharts(true);
                    handleExport();
                  }}
                  disabled={isExporting}
                >
                  <FileText className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {labels.allMetrics} - PDF
                </Button>

                <Button
                  variant="outline"
                  className={`justify-start ${isRTL ? 'flex-row-reverse font-arabic' : ''}`}
                  onClick={() => {
                    setSelectedMetrics(['cost']);
                    setExportFormat('excel');
                    setIncludeRawData(true);
                    handleExport();
                  }}
                  disabled={isExporting}
                >
                  <FileSpreadsheet className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {labels.cost} - Excel
                </Button>

                <Button
                  variant="outline"
                  className={`justify-start ${isRTL ? 'flex-row-reverse font-arabic' : ''}`}
                  onClick={() => {
                    setSelectedMetrics(['usage', 'activity']);
                    setExportFormat('csv');
                    setIncludeRawData(true);
                    handleExport();
                  }}
                  disabled={isExporting}
                >
                  <BarChart3 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {labels.usage} - CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Custom Export Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
              {labels.customExport}
            </h4>

            <div className="space-y-4">
              {/* Metrics Selection */}
              <div>
                <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 ${isRTL ? 'font-arabic text-right' : ''}`}>
                  {labels.selectMetrics}
                </label>
                <div className="flex flex-wrap gap-2">
                  {['usage', 'cost', 'performance', 'compliance', 'activity'].map((metric) => (
                    <button
                      key={metric}
                      onClick={() => toggleMetric(metric)}
                      className={`px-3 py-1 rounded-md text-sm border transition-colors ${
                        selectedMetrics.includes(metric)
                          ? 'bg-saudi-green-100 text-saudi-green-800 border-saudi-green-200 dark:bg-saudi-green-900/20'
                          : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300'
                      } ${isRTL ? 'font-arabic' : ''}`}
                    >
                      {metric === 'usage' ? labels.usage :
                       metric === 'cost' ? labels.cost :
                       metric === 'performance' ? labels.performance :
                       metric === 'compliance' ? labels.compliance : labels.activity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 ${isRTL ? 'font-arabic text-right' : ''}`}>
                  {labels.exportFormat}
                </label>
                <div className="flex gap-2">
                  {['pdf', 'excel', 'csv'].map((format) => (
                    <button
                      key={format}
                      onClick={() => setExportFormat(format as any)}
                      className={`px-3 py-2 rounded-md text-sm border transition-colors ${
                        exportFormat === format
                          ? 'bg-saudi-navy-100 text-saudi-navy-800 border-saudi-navy-200 dark:bg-saudi-navy-900/20'
                          : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300'
                      } ${isRTL ? 'font-arabic' : ''}`}
                    >
                      {format === 'pdf' ? labels.pdfFormat :
                       format === 'excel' ? labels.excelFormat : labels.csvFormat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="checkbox"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className={`rounded border-gray-300 text-saudi-green-600 focus:ring-saudi-green-500 ${isRTL ? 'ml-2' : 'mr-2'}`}
                  />
                  <span className={`text-sm text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                    {labels.includeCharts}
                  </span>
                </label>

                <label className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="checkbox"
                    checked={includeRawData}
                    onChange={(e) => setIncludeRawData(e.target.checked)}
                    className={`rounded border-gray-300 text-saudi-green-600 focus:ring-saudi-green-500 ${isRTL ? 'ml-2' : 'mr-2'}`}
                  />
                  <span className={`text-sm text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                    {labels.includeRawData}
                  </span>
                </label>
              </div>

              {/* Export Button */}
              <Button
                onClick={handleExport}
                disabled={isExporting || selectedMetrics.length === 0}
                className={`w-full ${isRTL ? 'font-arabic' : ''}`}
              >
                {isExporting ? (
                  <>
                    <RefreshCw className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {labels.creating}
                  </>
                ) : (
                  <>
                    <Download className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {labels.generateReport}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Reports Tab */}
      {activeTab === 'scheduled' && (
        <div className="space-y-4">
          {/* Header Actions */}
          <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
              {labels.scheduledReports}
            </h4>
            <Button className={`${isRTL ? 'font-arabic' : ''}`}>
              <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.createScheduled}
            </Button>
          </div>

          {/* Reports List */}
          {scheduledReports.length === 0 ? (
            <div className={`text-center py-8 ${isRTL ? 'font-arabic' : ''}`}>
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">{labels.noReports}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledReports.map((report) => (
                <div
                  key={report.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
                >
                  <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className={`flex items-center gap-3 mb-2 ${isRTL ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
                        <h5 className={`font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                          {isRTL ? report.nameArabic : report.name}
                        </h5>
                        <Badge className={`${getStatusColor(report.status)} text-xs`}>
                          {report.status === 'active' ? labels.active :
                           report.status === 'paused' ? labels.paused : labels.failed}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {report.frequency === 'daily' ? labels.daily :
                           report.frequency === 'weekly' ? labels.weekly :
                           report.frequency === 'monthly' ? labels.monthly : labels.quarterly}
                        </Badge>
                      </div>

                      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div>
                          <span className={`font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                            {labels.format}:
                          </span>
                          <span className="ml-1 text-saudi-navy-800 dark:text-white">
                            {report.format.toUpperCase()}
                          </span>
                        </div>

                        <div>
                          <span className={`font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                            {labels.recipients}:
                          </span>
                          <span className="ml-1 text-saudi-navy-800 dark:text-white">
                            {report.recipients.length} {isRTL ? 'مستلمين' : 'recipients'}
                          </span>
                        </div>

                        <div>
                          <span className={`font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                            {labels.nextRun}:
                          </span>
                          <span className="ml-1 text-saudi-navy-800 dark:text-white">
                            {formatDate(report.nextRun)}
                          </span>
                        </div>

                        {report.lastRun && (
                          <div>
                            <span className={`font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                              {labels.lastRun}:
                            </span>
                            <span className="ml-1 text-gray-600 dark:text-gray-400">
                              {formatDate(report.lastRun)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <span className={`font-medium text-gray-600 dark:text-gray-400 text-sm ${isRTL ? 'font-arabic' : ''}`}>
                          {labels.selectMetrics}:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {report.metrics.map((metric) => (
                            <Badge key={metric} variant="secondary" className="text-xs">
                              {metric === 'usage' ? labels.usage :
                               metric === 'cost' ? labels.cost :
                               metric === 'performance' ? labels.performance :
                               metric === 'compliance' ? labels.compliance : labels.activity}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={`flex flex-col gap-2 ${isRTL ? 'items-start' : 'items-end'}`}>
                      <Button variant="outline" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
                        <Clock className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {labels.runNow}
                      </Button>
                      
                      <Button variant="ghost" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
                        <Edit className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {labels.edit}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className={`${isRTL ? 'font-arabic' : ''} text-red-600 hover:text-red-700`}
                      >
                        <Trash2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {labels.delete}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.exportHistory}
          </h4>

          {exportProgress.length === 0 ? (
            <div className={`text-center py-8 ${isRTL ? 'font-arabic' : ''}`}>
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">{labels.noHistory}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exportProgress.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {exp.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : exp.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : exp.status === 'processing' ? (
                        <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                      ) : (
                        <Clock className="h-5 w-5 text-gray-400" />
                      )}

                      <div className={isRTL ? 'text-right' : 'text-left'}>
                        <p className={`font-medium text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                          {exp.status === 'completed' ? labels.exportCompleted :
                           exp.status === 'failed' ? labels.exportFailed :
                           exp.status === 'processing' ? labels.processing : labels.pending}
                        </p>
                        <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                          {formatDate(exp.createdAt)}
                          {exp.completedAt && ` - ${formatDate(exp.completedAt)}`}
                        </p>
                        {exp.error && (
                          <p className="text-sm text-red-600 mt-1">{exp.error}</p>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {exp.status === 'processing' && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {exp.progress}%
                        </div>
                      )}

                      {exp.status === 'completed' && exp.downloadUrl && (
                        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Button variant="outline" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
                            <Download className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                            {labels.downloadReport}
                          </Button>
                          
                          <Button variant="ghost" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
                            <Share2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                            {labels.share}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {exp.status === 'processing' && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${exp.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExportReports;