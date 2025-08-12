// Analytics types for HR Intelligence Platform
export interface AnalyticsMetrics {
  usage: UsageMetrics;
  cost: CostMetrics;
  performance: PerformanceMetrics;
  compliance: ComplianceMetrics;
  activity: ActivityMetrics;
}

export interface UsageMetrics {
  totalMessages: number;
  totalDocuments: number;
  totalTemplatesGenerated: number;
  totalApiCalls: number;
  dailyUsage: DailyUsage[];
  weeklyUsage: WeeklyUsage[];
  monthlyUsage: MonthlyUsage[];
  userActivityDistribution: UserActivity[];
  peakUsageHours: PeakUsage[];
}

export interface DailyUsage {
  date: string;
  messages: number;
  documents: number;
  templates: number;
  apiCalls: number;
  activeUsers: number;
}

export interface WeeklyUsage {
  week: string;
  weekStart: string;
  weekEnd: string;
  messages: number;
  documents: number;
  templates: number;
  apiCalls: number;
  uniqueUsers: number;
}

export interface MonthlyUsage {
  month: string;
  year: number;
  messages: number;
  documents: number;
  templates: number;
  apiCalls: number;
  uniqueUsers: number;
}

export interface UserActivity {
  userId: string;
  userName: string;
  department: string;
  messagesCount: number;
  documentsProcessed: number;
  templatesGenerated: number;
  lastActiveAt: string;
  role: string;
}

export interface PeakUsage {
  hour: number;
  day: string;
  averageMessages: number;
  averageUsers: number;
}

export interface CostMetrics {
  totalCost: number;
  monthlyCost: number;
  dailyCost: DailyCost[];
  modelBreakdown: ModelCostBreakdown[];
  costPerUser: number;
  costPerMessage: number;
  costTrend: CostTrend[];
  budgetUtilization: BudgetUtilization;
  projectedMonthlyCost: number;
}

export interface DailyCost {
  date: string;
  cost: number;
  tokensUsed: number;
  messagesProcessed: number;
}

export interface ModelCostBreakdown {
  modelName: string;
  provider: string;
  tokensUsed: number;
  cost: number;
  percentage: number;
  averageResponseTime: number;
}

export interface CostTrend {
  period: string;
  cost: number;
  changePercentage: number;
  tokensUsed: number;
}

export interface BudgetUtilization {
  monthlyBudget: number;
  currentSpend: number;
  utilizationPercentage: number;
  remainingBudget: number;
  daysRemaining: number;
  projectedOverage: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  uptime: number;
  throughput: number;
  responseTimeDistribution: ResponseTimeDistribution[];
  errorBreakdown: ErrorBreakdown[];
  systemHealth: SystemHealth;
}

export interface ResponseTimeDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface ErrorBreakdown {
  errorType: string;
  count: number;
  percentage: number;
  lastOccurrence: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  queueDepth: number;
}

export interface ComplianceMetrics {
  overallScore: number;
  categoryScores: CategoryScore[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issuesFound: ComplianceIssue[];
  complianceTrend: ComplianceTrend[];
  auditTrail: AuditEntry[];
  lastScanDate: string;
  nextScheduledScan: string;
}

export interface CategoryScore {
  category: string;
  categoryArabic: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: 'compliant' | 'warning' | 'non_compliant';
  issuesCount: number;
}

export interface ComplianceIssue {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  descriptionArabic: string;
  recommendation: string;
  recommendationArabic: string;
  laborLawReference: string;
  affectedDocuments: string[];
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface ComplianceTrend {
  date: string;
  score: number;
  issuesCount: number;
  resolvedIssues: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  userId: string;
  userName: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

export interface ActivityMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  userEngagement: UserEngagement;
  departmentActivity: DepartmentActivity[];
  timelineActivity: ActivityTimeline[];
  topFeatures: FeatureUsage[];
}

export interface UserEngagement {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  averageActionsPerSession: number;
  retentionRate: number;
}

export interface DepartmentActivity {
  department: string;
  departmentArabic: string;
  totalUsers: number;
  activeUsers: number;
  messagesCount: number;
  documentsCount: number;
  templatesCount: number;
  complianceScore: number;
}

export interface ActivityTimeline {
  timestamp: string;
  activity: string;
  activityArabic: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  changePercentage: number;
}

export interface FeatureUsage {
  featureName: string;
  featureNameArabic: string;
  usageCount: number;
  uniqueUsers: number;
  adoptionRate: number;
  trend: 'up' | 'down' | 'stable';
}

// API Response Types
export interface AnalyticsResponse<T> {
  data: T;
  meta: {
    organizationId: string;
    dateRange: {
      start: string;
      end: string;
    };
    timezone: string;
    generatedAt: string;
  };
  success: boolean;
  error?: string;
}

export interface TimeRange {
  start: Date;
  end: Date;
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface AnalyticsFilter {
  dateRange: TimeRange;
  departments?: string[];
  users?: string[];
  categories?: string[];
  languages?: ('ar' | 'en')[];
}

// Export types
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  metrics: (keyof AnalyticsMetrics)[];
  includeRawData: boolean;
  dateRange: TimeRange;
  includeCharts: boolean;
}

export interface ExportProgress {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// Real-time types
export interface RealtimeUpdate {
  type: 'metric_update' | 'alert' | 'system_status';
  data: any;
  timestamp: string;
}

export interface AnalyticsAlert {
  id: string;
  type: 'cost_threshold' | 'performance_degradation' | 'compliance_issue' | 'usage_spike';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  titleArabic: string;
  message: string;
  messageArabic: string;
  threshold?: number;
  currentValue?: number;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// Chart data types for Recharts
export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
  [key: string]: any;
}

export interface LineChartData {
  name: string;
  [key: string]: string | number;
}

export interface PieChartData {
  name: string;
  value: number;
  fill: string;
  percentage: number;
}

export interface BarChartData {
  name: string;
  value: number;
  fill?: string;
  [key: string]: any;
}

export interface HeatmapData {
  day: string;
  hour: number;
  value: number;
  intensity: number;
}