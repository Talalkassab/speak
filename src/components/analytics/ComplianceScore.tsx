'use client';

import React, { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  Settings,
  Filter,
  Search
} from 'lucide-react';
import { ComplianceMetrics, CategoryScore, ComplianceIssue, ComplianceTrend } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';

interface ComplianceScoreProps {
  data: ComplianceMetrics;
  language?: 'ar' | 'en';
  className?: string;
}

const ComplianceScore: React.FC<ComplianceScoreProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const [activeView, setActiveView] = useState<'overview' | 'categories' | 'issues' | 'trends'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [showResolved, setShowResolved] = useState(false);

  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'نقاط الامتثال لقانون العمل السعودي',
    subtitle: 'تقييم شامل للامتثال لأنظمة العمل والعمال في المملكة العربية السعودية',
    overview: 'نظرة عامة',
    categories: 'الفئات',
    issues: 'المشاكل المكتشفة',
    trends: 'اتجاهات الامتثال',
    overallScore: 'النقاط الإجمالية',
    complianceLevel: 'مستوى الامتثال',
    excellent: 'ممتاز',
    good: 'جيد',
    needsImprovement: 'يحتاج تحسين',
    critical: 'حرج',
    riskLevel: 'مستوى المخاطر',
    lowRisk: 'مخاطر منخفضة',
    mediumRisk: 'مخاطر متوسطة',
    highRisk: 'مخاطر عالية',
    criticalRisk: 'مخاطر حرجة',
    totalIssues: 'إجمالي المشاكل',
    activeIssues: 'المشاكل النشطة',
    resolvedIssues: 'المشاكل المحلولة',
    lastScan: 'آخر فحص',
    nextScan: 'الفحص القادم',
    categoryScore: 'نقاط الفئة',
    severity: 'الخطورة',
    description: 'الوصف',
    recommendation: 'التوصية',
    affectedDocuments: 'المستندات المتأثرة',
    laborLawReference: 'مرجع قانون العمل',
    createdDate: 'تاريخ الاكتشاف',
    status: 'الحالة',
    active: 'نشط',
    resolved: 'محلول',
    viewDetails: 'عرض التفاصيل',
    resolveIssue: 'حل المشكلة',
    markResolved: 'وضع علامة محلول',
    showResolved: 'عرض المحلولة',
    hideResolved: 'إخفاء المحلولة',
    allSeverities: 'جميع الخطورات',
    high: 'عالي',
    medium: 'متوسط',
    low: 'منخفض',
    filterBy: 'تصفية حسب',
    searchIssues: 'البحث في المشاكل',
    exportReport: 'تصدير التقرير',
    scheduleAudit: 'جدولة تدقيق',
    refreshData: 'تحديث البيانات',
    complianceSettings: 'إعدادات الامتثال',
    improvementRequired: 'تحسين مطلوب',
    onTrack: 'على المسار الصحيح',
    trending: 'الاتجاه',
    stable: 'مستقر',
    improving: 'في تحسن',
    declining: 'في تراجع'
  } : {
    title: 'Saudi Labor Law Compliance Score',
    subtitle: 'Comprehensive assessment of compliance with Saudi Arabian labor and employment regulations',
    overview: 'Overview',
    categories: 'Categories',
    issues: 'Issues Found',
    trends: 'Compliance Trends',
    overallScore: 'Overall Score',
    complianceLevel: 'Compliance Level',
    excellent: 'Excellent',
    good: 'Good',
    needsImprovement: 'Needs Improvement',
    critical: 'Critical',
    riskLevel: 'Risk Level',
    lowRisk: 'Low Risk',
    mediumRisk: 'Medium Risk',
    highRisk: 'High Risk',
    criticalRisk: 'Critical Risk',
    totalIssues: 'Total Issues',
    activeIssues: 'Active Issues',
    resolvedIssues: 'Resolved Issues',
    lastScan: 'Last Scan',
    nextScan: 'Next Scan',
    categoryScore: 'Category Score',
    severity: 'Severity',
    description: 'Description',
    recommendation: 'Recommendation',
    affectedDocuments: 'Affected Documents',
    laborLawReference: 'Labor Law Reference',
    createdDate: 'Created Date',
    status: 'Status',
    active: 'Active',
    resolved: 'Resolved',
    viewDetails: 'View Details',
    resolveIssue: 'Resolve Issue',
    markResolved: 'Mark Resolved',
    showResolved: 'Show Resolved',
    hideResolved: 'Hide Resolved',
    allSeverities: 'All Severities',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    filterBy: 'Filter by',
    searchIssues: 'Search issues',
    exportReport: 'Export Report',
    scheduleAudit: 'Schedule Audit',
    refreshData: 'Refresh Data',
    complianceSettings: 'Compliance Settings',
    improvementRequired: 'Improvement Required',
    onTrack: 'On Track',
    trending: 'Trending',
    stable: 'Stable',
    improving: 'Improving',
    declining: 'Declining'
  };

  // Get compliance level label and color
  const getComplianceLevel = (score: number) => {
    if (score >= 90) {
      return {
        label: labels.excellent,
        color: 'text-green-600 bg-green-100 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
        textColor: 'text-green-600'
      };
    } else if (score >= 80) {
      return {
        label: labels.good,
        color: 'text-blue-600 bg-blue-100 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
        textColor: 'text-blue-600'
      };
    } else if (score >= 70) {
      return {
        label: labels.needsImprovement,
        color: 'text-yellow-600 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
        textColor: 'text-yellow-600'
      };
    } else {
      return {
        label: labels.critical,
        color: 'text-red-600 bg-red-100 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
        textColor: 'text-red-600'
      };
    }
  };

  // Get risk level label and color
  const getRiskLevel = (level: string) => {
    switch (level) {
      case 'low':
        return {
          label: labels.lowRisk,
          color: 'text-green-600 bg-green-100 border-green-200 dark:bg-green-900/20 dark:text-green-400'
        };
      case 'medium':
        return {
          label: labels.mediumRisk,
          color: 'text-yellow-600 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
        };
      case 'high':
        return {
          label: labels.highRisk,
          color: 'text-orange-600 bg-orange-100 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400'
        };
      case 'critical':
        return {
          label: labels.criticalRisk,
          color: 'text-red-600 bg-red-100 border-red-200 dark:bg-red-900/20 dark:text-red-400'
        };
      default:
        return {
          label: labels.lowRisk,
          color: 'text-gray-600 bg-gray-100 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
        };
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-100 border-green-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Filter issues
  const filteredIssues = data.issuesFound.filter(issue => {
    if (!showResolved && issue.resolved) return false;
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    return true;
  });

  // Prepare chart data
  const categoryData = data.categoryScores.map(category => ({
    name: isRTL ? category.categoryArabic : category.category,
    score: category.score,
    maxScore: category.maxScore,
    percentage: category.percentage,
    fill: category.percentage >= 90 ? '#059669' : 
          category.percentage >= 80 ? '#0284c7' :
          category.percentage >= 70 ? '#d97706' : '#dc2626'
  }));

  const trendData = data.complianceTrend.map(trend => ({
    date: trend.date,
    score: trend.score,
    issues: trend.issuesCount,
    resolved: trend.resolvedIssues
  }));

  // Radial bar data for overall score
  const radialData = [{
    name: labels.overallScore,
    value: data.overallScore,
    fill: getComplianceLevel(data.overallScore).textColor.replace('text-', '#')
  }];

  const complianceLevel = getComplianceLevel(data.overallScore);
  const riskLevel = getRiskLevel(data.riskLevel);

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
        <div className={`${complianceLevel.color} border rounded-lg p-4`}>
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium ${isRTL ? 'font-arabic' : ''}`}>
                {labels.overallScore}
              </p>
              <p className="text-3xl font-bold">
                {data.overallScore}/100
              </p>
              <p className={`text-xs mt-1 ${isRTL ? 'font-arabic' : ''}`}>
                {complianceLevel.label}
              </p>
            </div>
            <Shield className="h-8 w-8" />
          </div>
        </div>

        <div className={`${riskLevel.color} border rounded-lg p-4`}>
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium ${isRTL ? 'font-arabic' : ''}`}>
                {labels.riskLevel}
              </p>
              <p className={`text-lg font-bold mt-2 ${isRTL ? 'font-arabic' : ''}`}>
                {riskLevel.label}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.activeIssues}
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {data.issuesFound.filter(i => !i.resolved).length}
              </p>
              <p className={`text-xs text-gray-500 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.totalIssues}: {data.issuesFound.length}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-green-700 dark:text-green-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.resolvedIssues}
              </p>
              <p className="text-2xl font-bold text-green-600">
                {data.issuesFound.filter(i => i.resolved).length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {['overview', 'categories', 'issues', 'trends'].map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view as any)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === view
                  ? 'bg-white dark:bg-gray-600 text-saudi-navy-800 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              } ${isRTL ? 'font-arabic' : ''}`}
            >
              {view === 'overview' ? labels.overview :
               view === 'categories' ? labels.categories :
               view === 'issues' ? labels.issues : labels.trends}
            </button>
          ))}
        </div>

        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button variant="outline" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
            <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.refreshData}
          </Button>
          
          <Button variant="outline" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
            <Download className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.exportReport}
          </Button>

          <Button variant="outline" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
            <Settings className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.complianceSettings}
          </Button>
        </div>
      </div>

      {/* Content based on active view */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overall Score Radial Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
              {labels.overallScore}
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={radialData}>
                <RadialBar
                  minAngle={15}
                  label={{ position: 'insideStart', fill: '#fff' }}
                  background
                  clockWise
                  dataKey="value"
                />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-current text-saudi-navy-800 dark:text-white">
                  {data.overallScore}
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
            
            <div className={`text-center mt-4 ${isRTL ? 'font-arabic' : ''}`}>
              <Badge className={`${complianceLevel.color}`}>
                {complianceLevel.label}
              </Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {labels.lastScan}: {new Date(data.lastScanDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
              </p>
            </div>
          </div>

          {/* Category Scores Bar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
              {labels.categoryScore}
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => [`${value}%`, labels.categoryScore]} />
                <Bar dataKey="percentage" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.categoryScores.map((category, index) => (
            <div
              key={index}
              className={`bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer ${
                selectedCategory === category.category ? 'ring-2 ring-saudi-green-500' : ''
              }`}
              onClick={() => setSelectedCategory(category.category === selectedCategory ? null : category.category)}
            >
              <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h4 className={`font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                  {isRTL ? category.categoryArabic : category.category}
                </h4>
                <Badge className={`${category.status === 'compliant' ? 'bg-green-100 text-green-800' : 
                                  category.status === 'warning' ? 'bg-yellow-100 text-yellow-800' : 
                                  'bg-red-100 text-red-800'}`}>
                  {category.percentage}%
                </Badge>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span className={isRTL ? 'font-arabic' : ''}>{category.score}</span>
                  <span>/ {category.maxScore}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      category.percentage >= 90 ? 'bg-green-500' :
                      category.percentage >= 80 ? 'bg-blue-500' :
                      category.percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${category.percentage}%` }}
                  />
                </div>
              </div>

              <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                  {category.issuesCount} {labels.issues}
                </span>
                <span className={`${category.status === 'compliant' ? 'text-green-600' : 
                                 category.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                                } font-medium ${isRTL ? 'font-arabic' : ''}`}>
                  {category.status === 'compliant' ? labels.good :
                   category.status === 'warning' ? labels.needsImprovement : labels.critical}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeView === 'issues' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className={`flex flex-col sm:flex-row gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as any)}
                className={`border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-sm ${isRTL ? 'font-arabic' : ''}`}
              >
                <option value="all">{labels.allSeverities}</option>
                <option value="critical">{labels.critical}</option>
                <option value="high">{labels.high}</option>
                <option value="medium">{labels.medium}</option>
                <option value="low">{labels.low}</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
              className={`${isRTL ? 'font-arabic' : ''}`}
            >
              <Eye className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {showResolved ? labels.hideResolved : labels.showResolved}
            </Button>
          </div>

          {/* Issues List */}
          <div className="space-y-4">
            {filteredIssues.length === 0 ? (
              <div className={`text-center py-8 ${isRTL ? 'font-arabic' : ''}`}>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {filterSeverity === 'all' ? 
                    (isRTL ? 'لا توجد مشاكل في الوقت الحالي' : 'No issues found') :
                    (isRTL ? `لا توجد مشاكل بخطورة ${filterSeverity}` : `No ${filterSeverity} severity issues found`)
                  }
                </p>
              </div>
            ) : (
              filteredIssues.map((issue, index) => (
                <div
                  key={issue.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${
                    issue.resolved ? 'opacity-60' : ''
                  }`}
                >
                  <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className={`flex items-center gap-3 mb-3 ${isRTL ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
                        <Badge className={`${getSeverityColor(issue.severity)} border text-xs`}>
                          {issue.severity === 'critical' ? labels.critical :
                           issue.severity === 'high' ? labels.high :
                           issue.severity === 'medium' ? labels.medium : labels.low}
                        </Badge>

                        <Badge variant={issue.resolved ? 'default' : 'destructive'} className="text-xs">
                          {issue.resolved ? labels.resolved : labels.active}
                        </Badge>

                        <span className={`text-xs text-gray-500 ${isRTL ? 'font-arabic' : ''}`}>
                          {issue.category}
                        </span>
                      </div>

                      <h4 className={`font-semibold text-saudi-navy-800 dark:text-white mb-2 ${isRTL ? 'font-arabic-heading' : ''}`}>
                        {isRTL ? issue.descriptionArabic : issue.description}
                      </h4>

                      <p className={`text-sm text-gray-600 dark:text-gray-400 mb-3 ${isRTL ? 'font-arabic' : ''}`}>
                        <strong>{labels.recommendation}:</strong> {isRTL ? issue.recommendationArabic : issue.recommendation}
                      </p>

                      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div>
                          <span className={`font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                            {labels.laborLawReference}:
                          </span>
                          <p className="text-saudi-navy-800 dark:text-white font-mono text-xs mt-1">
                            {issue.laborLawReference}
                          </p>
                        </div>

                        <div>
                          <span className={`font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                            {labels.affectedDocuments}:
                          </span>
                          <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                            {issue.affectedDocuments.length} {isRTL ? 'مستندات' : 'documents'}
                          </p>
                        </div>
                      </div>

                      <div className={`flex items-center gap-4 text-xs text-gray-500 mt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className={isRTL ? 'font-arabic' : ''}>
                          {labels.createdDate}: {new Date(issue.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                        </span>
                        
                        {issue.resolved && issue.resolvedAt && (
                          <span className={`text-green-600 ${isRTL ? 'font-arabic' : ''}`}>
                            {labels.resolved}: {new Date(issue.resolvedAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`flex flex-col gap-2 ${isRTL ? 'items-start' : 'items-end'}`}>
                      {!issue.resolved && (
                        <Button size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
                          <CheckCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {labels.markResolved}
                        </Button>
                      )}
                      
                      <Button variant="outline" size="sm" className={`${isRTL ? 'font-arabic' : ''}`}>
                        <FileText className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {labels.viewDetails}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeView === 'trends' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-6 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.trends}
          </h4>
          
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => new Date(value).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                formatter={(value: any, name: string) => [
                  value,
                  name === 'score' ? labels.overallScore :
                  name === 'issues' ? labels.activeIssues : labels.resolvedIssues
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#059669"
                strokeWidth={3}
                name={labels.overallScore}
              />
              <Line
                type="monotone"
                dataKey="issues"
                stroke="#dc2626"
                strokeWidth={2}
                name={labels.activeIssues}
              />
              <Line
                type="monotone"
                dataKey="resolved"
                stroke="#0284c7"
                strokeWidth={2}
                name={labels.resolvedIssues}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Trend Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'font-arabic' : ''}`}>
              <p className="text-sm text-gray-600 dark:text-gray-400">{labels.trending}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-600">{labels.improving}</span>
              </div>
            </div>

            <div className={`text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'font-arabic' : ''}`}>
              <p className="text-sm text-gray-600 dark:text-gray-400">{labels.nextScan}</p>
              <p className="font-semibold text-saudi-navy-800 dark:text-white mt-2">
                {new Date(data.nextScheduledScan).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
              </p>
            </div>

            <div className={`text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg ${isRTL ? 'font-arabic' : ''}`}>
              <p className="text-sm text-gray-600 dark:text-gray-400">{labels.complianceLevel}</p>
              <p className={`font-semibold mt-2 ${complianceLevel.textColor}`}>
                {complianceLevel.label}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceScore;