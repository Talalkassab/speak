// Enhanced Cost Management Types for HR Intelligence Platform

import { TimeRange } from './analytics';

export interface CostOptimizationRecommendation {
  id: string;
  type: 'model_routing' | 'usage_pattern' | 'budget_allocation' | 'performance_cost' | 'bulk_operations' | 'caching_strategy';
  title: string;
  titleArabic: string;
  description: string;
  descriptionArabic: string;
  potentialSavings: number;
  savingsPercentage: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  actions: RecommendationAction[];
  actionsArabic: RecommendationAction[];
  estimatedImplementationTime: number; // in hours
  riskLevel: 'low' | 'medium' | 'high';
  dependencies: string[];
  metrics: OptimizationMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationAction {
  id: string;
  description: string;
  completed: boolean;
  estimatedTime: number; // in minutes
  assignedTo?: string;
  dueDate?: string;
}

export interface OptimizationMetrics {
  currentCost: number;
  projectedCost: number;
  timeToROI: number; // in days
  confidenceLevel: number; // 0-100
  affectedUsers: number;
  qualityImpact: 'none' | 'minimal' | 'moderate' | 'significant';
}

export interface BudgetAlert {
  id: string;
  organizationId: string;
  type: 'threshold_reached' | 'projected_overage' | 'unusual_spike' | 'model_inefficiency';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  titleArabic: string;
  message: string;
  messageArabic: string;
  threshold: number;
  currentValue: number;
  projectedValue?: number;
  department?: string;
  userId?: string;
  triggeredAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  autoResolved: boolean;
  resolutionActions: string[];
  resolutionActionsArabic: string[];
}

export interface BudgetConfiguration {
  organizationId: string;
  monthlyBudget: number;
  departmentBudgets: DepartmentBudget[];
  alertThresholds: AlertThreshold[];
  autoOptimization: AutoOptimizationSettings;
  reportingSchedule: ReportingSchedule;
  costCaps: CostCap[];
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentBudget {
  department: string;
  departmentArabic: string;
  monthlyBudget: number;
  currentSpend: number;
  projectedSpend: number;
  utilizationPercentage: number;
  lastUpdated: string;
}

export interface AlertThreshold {
  type: 'percentage' | 'absolute';
  value: number;
  severity: 'warning' | 'critical';
  enabled: boolean;
  notificationChannels: ('email' | 'webhook' | 'dashboard')[];
  recipients: string[];
}

export interface AutoOptimizationSettings {
  enabled: boolean;
  maxSavingsPercentage: number;
  approvalRequired: boolean;
  allowedOptimizations: string[];
  blacklistedModels: string[];
  qualityThresholds: QualityThreshold[];
}

export interface QualityThreshold {
  metric: 'response_time' | 'accuracy' | 'user_satisfaction';
  minValue: number;
  weight: number;
}

export interface ReportingSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string; // HH:MM format
  timezone: string;
  recipients: string[];
  includeRecommendations: boolean;
  includeForecast: boolean;
}

export interface CostCap {
  type: 'daily' | 'weekly' | 'monthly';
  amount: number;
  action: 'alert' | 'throttle' | 'block';
  gracePeriod: number; // in minutes
  enabled: boolean;
}

export interface CostForecast {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  startDate: string;
  endDate: string;
  projectedCost: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    confidence: number;
  };
  factors: ForecastFactor[];
  accuracy: number; // historical accuracy percentage
  lastUpdated: string;
}

export interface ForecastFactor {
  name: string;
  nameArabic: string;
  impact: number; // -100 to +100
  confidence: number; // 0-100
  description: string;
  descriptionArabic: string;
}

export interface ModelPerformanceMetrics {
  modelName: string;
  provider: string;
  costPerToken: number;
  avgResponseTime: number;
  qualityScore: number;
  reliabilityScore: number;
  usageVolume: number;
  costEfficiency: number;
  userSatisfaction: number;
  errorRate: number;
  uptime: number;
  recommendedUseCases: string[];
  trends: {
    cost: 'increasing' | 'decreasing' | 'stable';
    performance: 'improving' | 'degrading' | 'stable';
    usage: 'growing' | 'declining' | 'stable';
  };
}

export interface CostAttribution {
  userId: string;
  userName: string;
  department: string;
  departmentArabic: string;
  role: string;
  totalCost: number;
  costBreakdown: {
    messages: number;
    documents: number;
    templates: number;
    voiceInteractions: number;
    other: number;
  };
  utilizationRate: number;
  costPerInteraction: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastActivity: string;
}

export interface ROIAnalysis {
  totalInvestment: number;
  totalSavings: number;
  netROI: number;
  roiPercentage: number;
  paybackPeriod: number; // in months
  productivity: {
    timesSaved: number; // in hours
    errorReduction: number; // percentage
    processEfficiency: number; // percentage
  };
  qualitativeImpacts: QualitativeImpact[];
  projectedBenefits: ProjectedBenefit[];
}

export interface QualitativeImpact {
  category: string;
  categoryArabic: string;
  description: string;
  descriptionArabic: string;
  impact: 'high' | 'medium' | 'low';
  measurable: boolean;
}

export interface ProjectedBenefit {
  period: string;
  costSavings: number;
  productivityGains: number;
  qualityImprovements: number;
  cumulativeSavings: number;
}

export interface ExportJobStatus {
  id: string;
  type: 'cost_report' | 'analytics_dashboard' | 'budget_analysis' | 'optimization_report';
  format: 'pdf' | 'excel' | 'csv';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  downloadExpiry?: string;
  error?: string;
  parameters: ExportParameters;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  fileSize?: number;
}

export interface ExportParameters {
  dateRange: TimeRange;
  includeCharts: boolean;
  includeRawData: boolean;
  departments?: string[];
  users?: string[];
  metrics: string[];
  language: 'ar' | 'en';
  branding: boolean;
  confidential: boolean;
}

export interface RealtimeCostUpdate {
  type: 'cost_update' | 'budget_alert' | 'recommendation_update' | 'optimization_complete';
  organizationId: string;
  data: {
    currentCost?: number;
    dailyCost?: number;
    projectedMonthlyCost?: number;
    alert?: BudgetAlert;
    recommendation?: CostOptimizationRecommendation;
    timestamp: string;
  };
  timestamp: string;
}

export interface ComprehensiveCostDashboardData {
  overview: CostOverviewData;
  realtime: RealtimeMetrics;
  forecasting: CostForecast[];
  recommendations: CostOptimizationRecommendation[];
  budgetConfiguration: BudgetConfiguration;
  modelPerformance: ModelPerformanceMetrics[];
  costAttribution: CostAttribution[];
  alerts: BudgetAlert[];
  roiAnalysis: ROIAnalysis;
  exportJobs: ExportJobStatus[];
}

export interface CostOverviewData {
  totalCost: number;
  dailyCost: number;
  weeklyCost: number;
  monthlyCost: number;
  projectedMonthlyCost: number;
  costTrend: number; // percentage change
  budgetUtilization: number; // percentage
  topCostDrivers: CostDriver[];
  savingsOpportunities: number;
  costEfficiencyScore: number;
}

export interface CostDriver {
  category: string;
  categoryArabic: string;
  cost: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
}

export interface RealtimeMetrics {
  currentHourCost: number;
  activeRequests: number;
  avgCostPerRequest: number;
  costVelocity: number; // cost increase rate per hour
  peakHourProjection: number;
  alertsActive: number;
  optimizationsActive: number;
  lastUpdated: string;
}

export interface CostOptimizationEngine {
  recommendations: CostOptimizationRecommendation[];
  potentialSavings: number;
  implementationRoadmap: ImplementationStep[];
  riskAssessment: RiskAssessment;
  impactAnalysis: ImpactAnalysis;
}

export interface ImplementationStep {
  id: string;
  title: string;
  titleArabic: string;
  description: string;
  descriptionArabic: string;
  priority: number;
  estimatedTime: number;
  estimatedSavings: number;
  dependencies: string[];
  risks: string[];
  successMetrics: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
}

export interface RiskFactor {
  factor: string;
  factorArabic: string;
  severity: 'low' | 'medium' | 'high';
  probability: number; // 0-100
  impact: string;
  impactArabic: string;
}

export interface MitigationStrategy {
  risk: string;
  strategy: string;
  strategyArabic: string;
  implementation: string;
  implementationArabic: string;
  effectiveness: number; // 0-100
}

export interface ImpactAnalysis {
  financialImpact: {
    shortTerm: number; // 3 months
    mediumTerm: number; // 12 months
    longTerm: number; // 24 months
  };
  operationalImpact: {
    userExperience: 'positive' | 'neutral' | 'negative';
    systemPerformance: 'improved' | 'unchanged' | 'degraded';
    maintenanceOverhead: 'reduced' | 'unchanged' | 'increased';
  };
  strategicImpact: {
    competitiveAdvantage: boolean;
    scalabilityImprovement: boolean;
    innovationOpportunities: string[];
  };
}