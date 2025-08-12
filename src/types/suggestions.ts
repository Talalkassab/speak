// Intelligent Query Suggestion System Types
export interface QuerySuggestion {
  id: string;
  text: string;
  textArabic: string;
  type: SuggestionType;
  category: SuggestionCategory;
  confidence: number;
  popularity: number;
  relevanceScore: number;
  metadata: SuggestionMetadata;
  createdAt: string;
  updatedAt: string;
}

export type SuggestionType = 
  | 'autocomplete'
  | 'related'
  | 'popular'
  | 'template'
  | 'refinement'
  | 'intent_based'
  | 'contextual'
  | 'followup';

export type SuggestionCategory = 
  | 'labor_law'
  | 'employment'
  | 'compensation'
  | 'benefits'
  | 'disciplinary'
  | 'termination'
  | 'compliance'
  | 'contracts'
  | 'policies'
  | 'training'
  | 'performance'
  | 'leaves'
  | 'recruitment'
  | 'general';

export interface SuggestionMetadata {
  tags: string[];
  tagsArabic: string[];
  entities: ExtractedEntity[];
  intent: QueryIntent;
  complexity: 'simple' | 'medium' | 'complex';
  expectedResponseLength: 'short' | 'medium' | 'long';
  requiresDocuments: boolean;
  legalReferences: string[];
  relatedTopics: string[];
}

export interface ExtractedEntity {
  text: string;
  textArabic?: string;
  type: EntityType;
  confidence: number;
  startPos: number;
  endPos: number;
}

export type EntityType = 
  | 'person'
  | 'organization'
  | 'date'
  | 'duration'
  | 'salary'
  | 'percentage'
  | 'law_article'
  | 'department'
  | 'job_title'
  | 'benefit_type'
  | 'leave_type'
  | 'contract_type';

export interface QueryIntent {
  primaryIntent: IntentType;
  secondaryIntents: IntentType[];
  confidence: number;
  requiresAction: boolean;
  expectedOutputType: 'answer' | 'document' | 'template' | 'calculation';
}

export type IntentType =
  | 'question'
  | 'request_document'
  | 'request_template'
  | 'calculate'
  | 'compare'
  | 'explain'
  | 'summarize'
  | 'translate'
  | 'check_compliance'
  | 'get_examples';

// Autocomplete System
export interface AutocompleteRequest {
  query: string;
  language: 'ar' | 'en' | 'both';
  maxSuggestions: number;
  userId: string;
  organizationId: string;
  context: QueryContext;
  includePopular: boolean;
  includePersonalized: boolean;
}

export interface AutocompleteResponse {
  suggestions: AutocompleteSuggestion[];
  hasMore: boolean;
  metadata: {
    processingTime: number;
    language: string;
    totalMatches: number;
  };
}

export interface AutocompleteSuggestion {
  text: string;
  textArabic?: string;
  highlightedText: string;
  highlightedTextArabic?: string;
  type: SuggestionType;
  score: number;
  category: SuggestionCategory;
  icon?: string;
  description?: string;
  descriptionArabic?: string;
}

// Related Questions
export interface RelatedQuestionsRequest {
  currentQuery: string;
  conversationHistory: ConversationMessage[];
  maxSuggestions: number;
  userId: string;
  organizationId: string;
  includeFollowup: boolean;
}

export interface RelatedQuestionsResponse {
  questions: RelatedQuestion[];
  context: RelatedQuestionsContext;
}

export interface RelatedQuestion {
  text: string;
  textArabic: string;
  category: SuggestionCategory;
  relevanceScore: number;
  isFollowup: boolean;
  estimatedComplexity: 'simple' | 'medium' | 'complex';
  relatedEntities: string[];
}

export interface RelatedQuestionsContext {
  mainTopic: string;
  mainTopicArabic: string;
  relatedTopics: string[];
  suggestedDocuments: string[];
}

export interface ConversationMessage {
  id: string;
  content: string;
  contentArabic?: string;
  role: 'user' | 'assistant';
  timestamp: string;
  metadata?: Record<string, any>;
}

// Popular Queries
export interface PopularQueriesRequest {
  organizationId: string;
  department?: string;
  timeframe: 'day' | 'week' | 'month' | 'quarter';
  category?: SuggestionCategory;
  language: 'ar' | 'en' | 'both';
  maxResults: number;
}

export interface PopularQueriesResponse {
  queries: PopularQuery[];
  trends: PopularityTrend[];
  insights: PopularityInsights;
}

export interface PopularQuery {
  text: string;
  textArabic: string;
  frequency: number;
  uniqueUsers: number;
  avgRating: number;
  category: SuggestionCategory;
  trending: boolean;
  trendDirection: 'up' | 'down' | 'stable';
  lastUsed: string;
  successRate: number;
}

export interface PopularityTrend {
  date: string;
  frequency: number;
  uniqueUsers: number;
  category: SuggestionCategory;
}

export interface PopularityInsights {
  topCategories: CategoryInsight[];
  peakUsageHours: number[];
  seasonalPatterns: SeasonalPattern[];
  emergingQueries: PopularQuery[];
}

export interface CategoryInsight {
  category: SuggestionCategory;
  categoryArabic: string;
  percentage: number;
  growth: number;
  avgComplexity: number;
}

export interface SeasonalPattern {
  pattern: string;
  months: number[];
  description: string;
  descriptionArabic: string;
}

// Query Refinement
export interface QueryRefinementRequest {
  originalQuery: string;
  context: QueryContext;
  userId: string;
  organizationId: string;
  includeTranslation: boolean;
}

export interface QueryRefinementResponse {
  refinements: QueryRefinement[];
  originalAnalysis: QueryAnalysis;
  recommendations: RefinementRecommendation[];
}

export interface QueryRefinement {
  refinedQuery: string;
  refinedQueryArabic: string;
  improvementType: RefinementType;
  score: number;
  reasoning: string;
  reasoningArabic: string;
  expectedImprovement: string;
}

export type RefinementType = 
  | 'clarity'
  | 'specificity'
  | 'completeness'
  | 'context'
  | 'grammar'
  | 'terminology'
  | 'scope';

export interface QueryAnalysis {
  clarity: number;
  specificity: number;
  completeness: number;
  grammarScore: number;
  terminologyAccuracy: number;
  issues: QueryIssue[];
  detectedLanguage: 'ar' | 'en' | 'mixed';
  entities: ExtractedEntity[];
}

export interface QueryIssue {
  type: 'vague' | 'incomplete' | 'grammar' | 'terminology' | 'scope';
  description: string;
  descriptionArabic: string;
  suggestion: string;
  suggestionArabic: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RefinementRecommendation {
  type: string;
  title: string;
  titleArabic: string;
  description: string;
  descriptionArabic: string;
  example: string;
  exampleArabic: string;
}

// Query Context
export interface QueryContext {
  currentPage?: string;
  conversationId?: string;
  previousQueries: string[];
  userRole: string;
  department: string;
  recentDocuments: string[];
  activeFilters: Record<string, any>;
  sessionDuration: number;
  userPreferences: UserSuggestionPreferences;
}

export interface UserSuggestionPreferences {
  preferredLanguage: 'ar' | 'en' | 'both';
  suggestionTypes: SuggestionType[];
  maxSuggestions: number;
  includeArabic: boolean;
  personalizationLevel: 'none' | 'basic' | 'advanced';
  categories: SuggestionCategory[];
}

// Templates
export interface QueryTemplate {
  id: string;
  name: string;
  nameArabic: string;
  template: string;
  templateArabic: string;
  category: SuggestionCategory;
  variables: TemplateVariable[];
  description: string;
  descriptionArabic: string;
  usageCount: number;
  rating: number;
  createdBy: string;
  organizationId: string;
  isPublic: boolean;
  tags: string[];
  examples: TemplateExample[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVariable {
  name: string;
  nameArabic: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect';
  required: boolean;
  description: string;
  descriptionArabic: string;
  options?: TemplateVariableOption[];
  validation?: TemplateValidation;
}

export interface TemplateVariableOption {
  value: string;
  label: string;
  labelArabic: string;
}

export interface TemplateValidation {
  pattern?: string;
  min?: number;
  max?: number;
  required?: boolean;
  custom?: string;
}

export interface TemplateExample {
  scenario: string;
  scenarioArabic: string;
  values: Record<string, any>;
  expectedResult: string;
  expectedResultArabic: string;
}

// Arabic Language Processing
export interface ArabicProcessingConfig {
  enableDialectSupport: boolean;
  supportedDialects: ArabicDialect[];
  enableTransliteration: boolean;
  enableDiacriticHandling: boolean;
  enableRootExtraction: boolean;
  customDictionary: ArabicDictionaryEntry[];
}

export type ArabicDialect = 
  | 'msa' // Modern Standard Arabic
  | 'gulf'
  | 'saudi'
  | 'egyptian'
  | 'levantine'
  | 'maghrebi';

export interface ArabicDictionaryEntry {
  arabic: string;
  transliteration: string;
  english: string;
  category: string;
  isHRTerm: boolean;
  isLegalTerm: boolean;
  synonyms: string[];
  synonymsArabic: string[];
}

export interface ArabicTextAnalysis {
  originalText: string;
  normalizedText: string;
  detectedDialect: ArabicDialect;
  confidence: number;
  entities: ExtractedEntity[];
  transliteration: string;
  translation: string;
  hrTerms: ArabicDictionaryEntry[];
  suggestions: string[];
}

// Personalization
export interface PersonalizationData {
  userId: string;
  queryHistory: PersonalizedQuery[];
  preferences: UserSuggestionPreferences;
  learningProfile: LearningProfile;
  interactionPatterns: InteractionPattern[];
  topCategories: string[];
  frequentEntities: string[];
  responsePreferences: ResponsePreference[];
}

export interface PersonalizedQuery {
  query: string;
  category: SuggestionCategory;
  timestamp: string;
  success: boolean;
  rating?: number;
  timeSpent: number;
  followupQueries: string[];
}

export interface LearningProfile {
  expertiseLevel: 'beginner' | 'intermediate' | 'expert';
  preferredComplexity: 'simple' | 'medium' | 'complex';
  knowledgeAreas: string[];
  weakAreas: string[];
  improvingAreas: string[];
  learningGoals: string[];
}

export interface InteractionPattern {
  pattern: string;
  frequency: number;
  timeOfDay: number[];
  dayOfWeek: number[];
  sessionDuration: number;
  queriesPerSession: number;
}

export interface ResponsePreference {
  type: 'format' | 'length' | 'detail' | 'language';
  preference: string;
  confidence: number;
  updatedAt: string;
}

// Analytics & Performance
export interface SuggestionAnalytics {
  totalSuggestions: number;
  acceptanceRate: number;
  averageResponseTime: number;
  topCategories: CategoryAnalytics[];
  performanceMetrics: SuggestionPerformanceMetrics;
  userSatisfaction: UserSatisfactionMetrics;
  errorMetrics: SuggestionErrorMetrics;
}

export interface CategoryAnalytics {
  category: SuggestionCategory;
  suggestionsCount: number;
  acceptanceRate: number;
  averageRating: number;
  responseTime: number;
  userEngagement: number;
}

export interface SuggestionPerformanceMetrics {
  autocompleteLatency: number;
  relatedQuestionsLatency: number;
  refinementLatency: number;
  cacheHitRate: number;
  throughput: number;
  errorRate: number;
}

export interface UserSatisfactionMetrics {
  overallRating: number;
  feedbackCount: number;
  positiveRatio: number;
  topIssues: SatisfactionIssue[];
  improvementAreas: string[];
}

export interface SatisfactionIssue {
  issue: string;
  issueArabic: string;
  frequency: number;
  impact: 'low' | 'medium' | 'high';
  resolution: string;
  resolutionArabic: string;
}

export interface SuggestionErrorMetrics {
  totalErrors: number;
  errorsByType: ErrorTypeMetrics[];
  errorRate: number;
  averageRecoveryTime: number;
  criticalErrors: number;
}

export interface ErrorTypeMetrics {
  type: string;
  count: number;
  percentage: number;
  averageImpact: number;
  lastOccurrence: string;
}

// Cache & Optimization
export interface SuggestionCache {
  key: string;
  data: any;
  ttl: number;
  createdAt: string;
  accessCount: number;
  lastAccessed: string;
  size: number;
}

export interface CacheStrategy {
  type: 'memory' | 'redis' | 'database';
  ttl: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
  keyPattern: string;
  preloadRules: PreloadRule[];
}

export interface PreloadRule {
  condition: string;
  data: string[];
  priority: number;
  schedule?: string;
}

// API Response Types
export interface SuggestionAPIResponse<T> {
  success: boolean;
  data: T;
  metadata: {
    processingTime: number;
    cacheHit: boolean;
    source: string;
    version: string;
    requestId: string;
  };
  error?: {
    code: string;
    message: string;
    messageArabic: string;
    details?: any;
  };
}

export interface BatchSuggestionRequest {
  requests: {
    type: SuggestionType;
    params: any;
  }[];
  userId: string;
  organizationId: string;
  priority: 'low' | 'normal' | 'high';
}

export interface BatchSuggestionResponse {
  results: {
    type: SuggestionType;
    success: boolean;
    data?: any;
    error?: string;
  }[];
  metadata: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalProcessingTime: number;
  };
}