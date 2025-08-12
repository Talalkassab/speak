'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target,
  AlertTriangle,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  Bell,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import type { BudgetConfiguration, DepartmentBudget, AlertThreshold, BudgetAlert } from '@/types/enhanced-cost-analytics';

interface BudgetManagementProps {
  data: BudgetConfiguration;
  language?: 'ar' | 'en';
  className?: string;
}

const BudgetManagement: React.FC<BudgetManagementProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [newThreshold, setNewThreshold] = useState<Partial<AlertThreshold>>({});
  const [showAddThreshold, setShowAddThreshold] = useState(false);

  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'إدارة الميزانية',
    subtitle: 'إعداد ومراقبة ميزانيات التكلفة والتنبيهات',
    overview: 'نظرة عامة',
    departments: 'الأقسام',
    alerts: 'التنبيهات',
    settings: 'الإعدادات',
    monthlyBudget: 'الميزانية الشهرية',
    currentSpend: 'الإنفاق الحالي',
    projectedSpend: 'الإنفاق المتوقع',
    remainingBudget: 'الميزانية المتبقية',
    budgetUtilization: 'استخدام الميزانية',
    overBudget: 'تجاوز الميزانية',
    onTrack: 'في المسار الصحيح',
    underBudget: 'أقل من الميزانية',
    atRisk: 'في خطر',
    departmentBudgets: 'ميزانيات الأقسام',
    alertThresholds: 'عتبات التنبيه',
    budgetAlerts: 'تنبيهات الميزانية',
    addThreshold: 'إضافة عتبة',
    editBudget: 'تعديل الميزانية',
    saveBudget: 'حفظ الميزانية',
    cancel: 'إلغاء',
    delete: 'حذف',
    percentage: 'نسبة مئوية',
    absolute: 'مطلق',
    warning: 'تحذير',
    critical: 'حرج',
    enabled: 'مفعل',
    disabled: 'معطل',
    thresholdType: 'نوع العتبة',
    thresholdValue: 'قيمة العتبة',
    severity: 'الشدة',
    status: 'الحالة',
    notifications: 'الإشعارات',
    email: 'بريد إلكتروني',
    webhook: 'ويب هوك',
    dashboard: 'لوحة التحكم',
    recipients: 'المستقبلون',
    autoOptimization: 'التحسين التلقائي',
    reportingSchedule: 'جدولة التقارير',
    costCaps: 'حدود التكلفة',
    frequency: 'التكرار',
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    lastUpdated: 'آخر تحديث',
    save: 'حفظ',
    budgetAnalysis: 'تحليل الميزانية',
    forecastedOverage: 'التجاوز المتوقع',
    daysRemaining: 'الأيام المتبقية',
    burnRate: 'معدل الاستهلاك',
    efficiency: 'الكفاءة'
  } : {
    title: 'Budget Management',
    subtitle: 'Set up and monitor cost budgets and alerts',
    overview: 'Overview',
    departments: 'Departments',
    alerts: 'Alerts',
    settings: 'Settings',
    monthlyBudget: 'Monthly Budget',
    currentSpend: 'Current Spend',
    projectedSpend: 'Projected Spend',
    remainingBudget: 'Remaining Budget',
    budgetUtilization: 'Budget Utilization',
    overBudget: 'Over Budget',
    onTrack: 'On Track',
    underBudget: 'Under Budget',
    atRisk: 'At Risk',
    departmentBudgets: 'Department Budgets',
    alertThresholds: 'Alert Thresholds',
    budgetAlerts: 'Budget Alerts',
    addThreshold: 'Add Threshold',
    editBudget: 'Edit Budget',
    saveBudget: 'Save Budget',
    cancel: 'Cancel',
    delete: 'Delete',
    percentage: 'Percentage',
    absolute: 'Absolute',
    warning: 'Warning',
    critical: 'Critical',
    enabled: 'Enabled',
    disabled: 'Disabled',
    thresholdType: 'Threshold Type',
    thresholdValue: 'Threshold Value',
    severity: 'Severity',
    status: 'Status',
    notifications: 'Notifications',
    email: 'Email',
    webhook: 'Webhook',
    dashboard: 'Dashboard',
    recipients: 'Recipients',
    autoOptimization: 'Auto Optimization',
    reportingSchedule: 'Reporting Schedule',
    costCaps: 'Cost Caps',
    frequency: 'Frequency',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    lastUpdated: 'Last Updated',
    save: 'Save',
    budgetAnalysis: 'Budget Analysis',
    forecastedOverage: 'Forecasted Overage',
    daysRemaining: 'Days Remaining',
    burnRate: 'Burn Rate',
    efficiency: 'Efficiency'
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getBudgetStatus = (utilization: number) => {
    if (utilization > 100) return { label: labels.overBudget, color: 'bg-red-100 text-red-800 border-red-200' };
    if (utilization > 85) return { label: labels.atRisk, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    if (utilization > 50) return { label: labels.onTrack, color: 'bg-blue-100 text-blue-800 border-blue-200' };
    return { label: labels.underBudget, color: 'bg-green-100 text-green-800 border-green-200' };
  };

  // Mock department budgets data
  const departmentBudgets: DepartmentBudget[] = [
    {
      department: 'Human Resources',
      departmentArabic: 'الموارد البشرية',
      monthlyBudget: 500,
      currentSpend: 387.50,
      projectedSpend: 465.00,
      utilizationPercentage: 77.5,
      lastUpdated: new Date().toISOString()
    },
    {
      department: 'Legal Department',
      departmentArabic: 'القسم القانوني',
      monthlyBudget: 300,
      currentSpend: 298.75,
      projectedSpend: 315.20,
      utilizationPercentage: 99.6,
      lastUpdated: new Date().toISOString()
    },
    {
      department: 'Operations',
      departmentArabic: 'العمليات',
      monthlyBudget: 250,
      currentSpend: 156.30,
      projectedSpend: 201.45,
      utilizationPercentage: 62.5,
      lastUpdated: new Date().toISOString()
    }
  ];

  // Mock alert thresholds
  const alertThresholds: AlertThreshold[] = [
    {
      type: 'percentage',
      value: 75,
      severity: 'warning',
      enabled: true,
      notificationChannels: ['email', 'dashboard'],
      recipients: ['admin@company.com']
    },
    {
      type: 'percentage',
      value: 90,
      severity: 'critical',
      enabled: true,
      notificationChannels: ['email', 'webhook', 'dashboard'],
      recipients: ['admin@company.com', 'finance@company.com']
    }
  ];

  // Calculate overall metrics
  const totalBudget = departmentBudgets.reduce((sum, dept) => sum + dept.monthlyBudget, 0);
  const totalCurrentSpend = departmentBudgets.reduce((sum, dept) => sum + dept.currentSpend, 0);
  const totalProjectedSpend = departmentBudgets.reduce((sum, dept) => sum + dept.projectedSpend, 0);
  const overallUtilization = (totalCurrentSpend / totalBudget) * 100;
  const remainingBudget = totalBudget - totalCurrentSpend;
  const forecastedOverage = Math.max(0, totalProjectedSpend - totalBudget);

  const departmentChartData = departmentBudgets.map(dept => ({
    name: isRTL ? dept.departmentArabic.slice(0, 10) : dept.department.slice(0, 10),
    budget: dept.monthlyBudget,
    current: dept.currentSpend,
    projected: dept.projectedSpend,
    utilization: dept.utilizationPercentage
  }));

  const utilizationPieData = departmentBudgets.map((dept, index) => ({
    name: isRTL ? dept.departmentArabic : dept.department,
    value: dept.currentSpend,
    fill: index === 0 ? '#1e40af' : index === 1 ? '#7c3aed' : '#059669'
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-blue-700 dark:text-blue-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.monthlyBudget}
              </p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {formatCurrency(totalBudget)}
              </p>
            </div>
            <Target className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-green-700 dark:text-green-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.currentSpend}
              </p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                {formatCurrency(totalCurrentSpend)}
              </p>
              <p className={`text-sm text-green-600 dark:text-green-400 ${isRTL ? 'font-arabic' : ''}`}>
                {overallUtilization.toFixed(1)}% {labels.utilized}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-purple-700 dark:text-purple-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.remainingBudget}
              </p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                {formatCurrency(remainingBudget)}
              </p>
              <p className={`text-sm text-purple-600 dark:text-purple-400 ${isRTL ? 'font-arabic' : ''}`}>
                {((remainingBudget / totalBudget) * 100).toFixed(1)}% {labels.remaining}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-orange-700 dark:text-orange-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.forecastedOverage}
              </p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                {formatCurrency(forecastedOverage)}
              </p>
              {forecastedOverage > 0 && (
                <Badge variant="destructive" className={`text-xs mt-1 ${isRTL ? 'font-arabic' : ''}`}>
                  {labels.overBudget}
                </Badge>
              )}
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full grid-cols-4`}>
          <TabsTrigger value="overview" className={isRTL ? 'font-arabic' : ''}>
            <Target className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.overview}
          </TabsTrigger>
          <TabsTrigger value="departments" className={isRTL ? 'font-arabic' : ''}>
            <Users className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.departments}
          </TabsTrigger>
          <TabsTrigger value="alerts" className={isRTL ? 'font-arabic' : ''}>
            <Bell className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.alerts}
          </TabsTrigger>
          <TabsTrigger value="settings" className={isRTL ? 'font-arabic' : ''}>
            <Settings className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.settings}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget vs Spend Chart */}
            <Card className="p-6">
              <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
                {labels.budgetAnalysis}
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Bar dataKey="budget" fill="#1e40af" name={labels.monthlyBudget} />
                  <Bar dataKey="current" fill="#059669" name={labels.currentSpend} />
                  <Bar dataKey="projected" fill="#dc2626" name={labels.projectedSpend} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Spend Distribution */}
            <Card className="p-6">
              <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
                {labels.currentSpend} - {labels.departments}
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={utilizationPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ value }) => formatCurrency(value)}
                  >
                    {utilizationPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-6">
          <div className="space-y-4">
            {departmentBudgets.map((dept, index) => {
              const status = getBudgetStatus(dept.utilizationPercentage);
              const isEditing = editingBudget === dept.department;

              return (
                <Card key={index} className="p-6">
                  <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <h4 className={`text-lg font-semibold text-gray-900 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                        {isRTL ? dept.departmentArabic : dept.department}
                      </h4>
                      <Badge className={`${status.color} text-xs mt-1 ${isRTL ? 'font-arabic' : ''}`}>
                        {status.label}
                      </Badge>
                    </div>
                    
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {!isEditing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingBudget(dept.department)}
                          className={isRTL ? 'font-arabic' : ''}
                        >
                          <Edit className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {labels.editBudget}
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => setEditingBudget(null)}
                            className={isRTL ? 'font-arabic' : ''}
                          >
                            <Save className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                            {labels.save}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingBudget(null)}
                            className={isRTL ? 'font-arabic' : ''}
                          >
                            <X className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                            {labels.cancel}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                        {labels.monthlyBudget}
                      </p>
                      {isEditing ? (
                        <Input
                          type="number"
                          defaultValue={dept.monthlyBudget}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatCurrency(dept.monthlyBudget)}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                        {labels.currentSpend}
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(dept.currentSpend)}
                      </p>
                    </div>

                    <div>
                      <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                        {labels.projectedSpend}
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(dept.projectedSpend)}
                      </p>
                    </div>

                    <div>
                      <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                        {labels.budgetUtilization}
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {dept.utilizationPercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${
                        dept.utilizationPercentage > 100 ? 'bg-red-500' :
                        dept.utilizationPercentage > 85 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, dept.utilizationPercentage)}%` }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h4 className={`text-lg font-semibold text-gray-900 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
              {labels.alertThresholds}
            </h4>
            <Button
              onClick={() => setShowAddThreshold(true)}
              className={isRTL ? 'font-arabic' : ''}
            >
              <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.addThreshold}
            </Button>
          </div>

          <div className="space-y-4">
            {alertThresholds.map((threshold, index) => (
              <Card key={index} className="p-4">
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className={`font-medium text-gray-900 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                        {threshold.value}{threshold.type === 'percentage' ? '%' : ' USD'} - {
                          threshold.severity === 'warning' ? labels.warning : labels.critical
                        }
                      </p>
                      <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                        {labels.notifications}: {threshold.notificationChannels.join(', ')}
                      </p>
                    </div>
                    
                    <Badge className={`${threshold.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} ${isRTL ? 'font-arabic' : ''}`}>
                      {threshold.enabled ? labels.enabled : labels.disabled}
                    </Badge>
                  </div>

                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
                {labels.autoOptimization}
              </h4>
              <div className="space-y-4">
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                    {labels.enabled}
                  </span>
                  <Button variant="outline" size="sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
                {labels.reportingSchedule}
              </h4>
              <div className="space-y-4">
                <div>
                  <label className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                    {labels.frequency}
                  </label>
                  <select className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    <option value="daily">{labels.daily}</option>
                    <option value="weekly">{labels.weekly}</option>
                    <option value="monthly">{labels.monthly}</option>
                  </select>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BudgetManagement;