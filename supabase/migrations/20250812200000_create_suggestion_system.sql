-- Create suggestion system tables for HR Intelligence Platform

-- Table for storing query suggestions
CREATE TABLE IF NOT EXISTS query_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    text_arabic TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('autocomplete', 'related', 'popular', 'template', 'refinement', 'intent_based', 'contextual', 'followup')),
    category VARCHAR(20) NOT NULL CHECK (category IN ('labor_law', 'employment', 'compensation', 'benefits', 'disciplinary', 'termination', 'compliance', 'contracts', 'policies', 'training', 'performance', 'leaves', 'recruitment', 'general')),
    confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    popularity INTEGER DEFAULT 0,
    relevance_score DECIMAL(3,2) DEFAULT 0.5 CHECK (relevance_score >= 0 AND relevance_score <= 1),
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    entities JSONB DEFAULT '[]',
    description TEXT,
    description_arabic TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing query templates
CREATE TABLE IF NOT EXISTS query_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    name_arabic VARCHAR(200) NOT NULL,
    template TEXT NOT NULL,
    template_arabic TEXT NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('labor_law', 'employment', 'compensation', 'benefits', 'disciplinary', 'termination', 'compliance', 'contracts', 'policies', 'training', 'performance', 'leaves', 'recruitment', 'general')),
    description TEXT NOT NULL,
    description_arabic TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    examples JSONB DEFAULT '[]',
    tags TEXT[] DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking popular queries per organization
CREATE TABLE IF NOT EXISTS popular_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    text_arabic TEXT,
    category VARCHAR(20) NOT NULL CHECK (category IN ('labor_law', 'employment', 'compensation', 'benefits', 'disciplinary', 'termination', 'compliance', 'contracts', 'policies', 'training', 'performance', 'leaves', 'recruitment', 'general')),
    department VARCHAR(100),
    frequency INTEGER DEFAULT 1,
    unique_users INTEGER DEFAULT 1,
    avg_rating DECIMAL(3,2) DEFAULT 0 CHECK (avg_rating >= 0 AND avg_rating <= 5),
    success_rate DECIMAL(5,2) DEFAULT 100 CHECK (success_rate >= 0 AND success_rate <= 100),
    trending BOOLEAN DEFAULT false,
    trend_direction VARCHAR(10) DEFAULT 'stable' CHECK (trend_direction IN ('up', 'down', 'stable')),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, text)
);

-- Table for user query history and personalization
CREATE TABLE IF NOT EXISTS user_query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    query_arabic TEXT,
    category VARCHAR(20) DEFAULT 'general' CHECK (category IN ('labor_law', 'employment', 'compensation', 'benefits', 'disciplinary', 'termination', 'compliance', 'contracts', 'policies', 'training', 'performance', 'leaves', 'recruitment', 'general')),
    frequency INTEGER DEFAULT 1,
    success_rate DECIMAL(5,2) DEFAULT 100 CHECK (success_rate >= 0 AND success_rate <= 100),
    avg_response_time INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, query)
);

-- Table for suggestion analytics
CREATE TABLE IF NOT EXISTS suggestion_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(20) NOT NULL CHECK (suggestion_type IN ('autocomplete', 'related', 'popular', 'refinement', 'templates')),
    query TEXT,
    language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('ar', 'en', 'both')),
    response_time INTEGER DEFAULT 0,
    cache_hit BOOLEAN DEFAULT false,
    suggestions_count INTEGER DEFAULT 0,
    category VARCHAR(20),
    timeframe VARCHAR(20),
    department VARCHAR(100),
    conversation_length INTEGER,
    original_query_quality DECIMAL(3,2),
    trends_included BOOLEAN DEFAULT false,
    insights_included BOOLEAN DEFAULT false,
    search_query TEXT,
    method VARCHAR(10) DEFAULT 'GET' CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for suggestion feedback
CREATE TABLE IF NOT EXISTS suggestion_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(20) NOT NULL CHECK (suggestion_type IN ('autocomplete', 'related', 'popular', 'refinement', 'templates')),
    question_id UUID,
    selected_question TEXT,
    selected_refinement TEXT,
    original_query TEXT,
    feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('helpful', 'not_helpful', 'irrelevant', 'excellent', 'good', 'poor')),
    improvement_type VARCHAR(20),
    helpfulness_rating INTEGER CHECK (helpfulness_rating >= 1 AND helpfulness_rating <= 5),
    applied_refinement BOOLEAN DEFAULT false,
    applied_suggestion BOOLEAN DEFAULT false,
    feedback_text TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for query quality analytics
CREATE TABLE IF NOT EXISTS query_quality_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    original_query TEXT NOT NULL,
    clarity_score DECIMAL(4,2) DEFAULT 0 CHECK (clarity_score >= 0 AND clarity_score <= 10),
    specificity_score DECIMAL(4,2) DEFAULT 0 CHECK (specificity_score >= 0 AND specificity_score <= 10),
    completeness_score DECIMAL(4,2) DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 10),
    grammar_score DECIMAL(4,2) DEFAULT 0 CHECK (grammar_score >= 0 AND grammar_score <= 10),
    terminology_accuracy DECIMAL(4,2) DEFAULT 0 CHECK (terminology_accuracy >= 0 AND terminology_accuracy <= 10),
    detected_language VARCHAR(10) DEFAULT 'en' CHECK (detected_language IN ('ar', 'en', 'mixed')),
    complexity VARCHAR(10) DEFAULT 'medium' CHECK (complexity IN ('simple', 'medium', 'complex')),
    issues_found INTEGER DEFAULT 0,
    refinements_generated INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for user interaction patterns
CREATE TABLE IF NOT EXISTS user_interaction_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL,
    query TEXT,
    previous_query TEXT,
    context_length INTEGER DEFAULT 0,
    session_duration INTEGER DEFAULT 0,
    queries_per_session INTEGER DEFAULT 1,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for user preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    preference_type VARCHAR(50) NOT NULL,
    preferences JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, preference_type)
);

-- Table for user query interactions (for tracking what users select)
CREATE TABLE IF NOT EXISTS user_query_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('selected', 'dismissed', 'copied', 'refined', 'applied')),
    category VARCHAR(20) DEFAULT 'general',
    department VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for refinement performance tracking
CREATE TABLE IF NOT EXISTS refinement_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_query TEXT NOT NULL,
    refined_query TEXT NOT NULL,
    improvement_type VARCHAR(20) NOT NULL,
    selection_count INTEGER DEFAULT 1,
    average_helpfulness DECIMAL(3,2) DEFAULT 0,
    last_selected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(original_query, refined_query)
);

-- Table for AI learning feedback
CREATE TABLE IF NOT EXISTS ai_learning_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feature_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL DEFAULT '{}',
    output_data JSONB NOT NULL DEFAULT '{}',
    user_satisfaction INTEGER CHECK (user_satisfaction >= 1 AND user_satisfaction <= 5),
    applied_suggestion BOOLEAN DEFAULT false,
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for suggestion performance
CREATE TABLE IF NOT EXISTS suggestion_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID,
    suggestion_text TEXT,
    suggestion_type VARCHAR(20) NOT NULL,
    user_interactions INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    selection_rate DECIMAL(5,2) DEFAULT 0,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(suggestion_id)
);

-- Table for query template usage tracking
CREATE TABLE IF NOT EXISTS query_template_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES query_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    generated_query TEXT,
    variables_used JSONB DEFAULT '{}',
    success BOOLEAN DEFAULT true,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_query_suggestions_org_type ON query_suggestions(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_query_suggestions_category ON query_suggestions(category);
CREATE INDEX IF NOT EXISTS idx_query_suggestions_popularity ON query_suggestions(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_query_suggestions_text ON query_suggestions USING gin(to_tsvector('english', text));
CREATE INDEX IF NOT EXISTS idx_query_suggestions_text_arabic ON query_suggestions USING gin(to_tsvector('arabic', text_arabic));

CREATE INDEX IF NOT EXISTS idx_query_templates_org_category ON query_templates(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_query_templates_public ON query_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_query_templates_usage ON query_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_query_templates_rating ON query_templates(rating DESC);

CREATE INDEX IF NOT EXISTS idx_popular_queries_org_freq ON popular_queries(organization_id, frequency DESC);
CREATE INDEX IF NOT EXISTS idx_popular_queries_trending ON popular_queries(trending) WHERE trending = true;
CREATE INDEX IF NOT EXISTS idx_popular_queries_category ON popular_queries(category);
CREATE INDEX IF NOT EXISTS idx_popular_queries_last_used ON popular_queries(last_used DESC);

CREATE INDEX IF NOT EXISTS idx_user_query_history_user ON user_query_history(user_id, last_used DESC);
CREATE INDEX IF NOT EXISTS idx_user_query_history_frequency ON user_query_history(frequency DESC);

CREATE INDEX IF NOT EXISTS idx_suggestion_analytics_user_time ON suggestion_analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestion_analytics_org_type ON suggestion_analytics(organization_id, suggestion_type);
CREATE INDEX IF NOT EXISTS idx_suggestion_analytics_created_at ON suggestion_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suggestion_feedback_user_type ON suggestion_feedback(user_id, suggestion_type);
CREATE INDEX IF NOT EXISTS idx_suggestion_feedback_created_at ON suggestion_feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_quality_analytics_user ON query_quality_analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_quality_analytics_scores ON query_quality_analytics(clarity_score, specificity_score, completeness_score);

CREATE INDEX IF NOT EXISTS idx_user_interaction_patterns_user ON user_interaction_patterns(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_interaction_patterns_type ON user_interaction_patterns(interaction_type);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_type ON user_preferences(user_id, preference_type);

CREATE INDEX IF NOT EXISTS idx_user_query_interactions_user ON user_query_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_query_interactions_action ON user_query_interactions(action);

CREATE INDEX IF NOT EXISTS idx_refinement_performance_queries ON refinement_performance(original_query, refined_query);
CREATE INDEX IF NOT EXISTS idx_refinement_performance_selection ON refinement_performance(selection_count DESC);

CREATE INDEX IF NOT EXISTS idx_ai_learning_feedback_feature ON ai_learning_feedback(feature_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_learning_feedback_satisfaction ON ai_learning_feedback(user_satisfaction);

CREATE INDEX IF NOT EXISTS idx_suggestion_performance_type ON suggestion_performance(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_suggestion_performance_rating ON suggestion_performance(average_rating DESC);

CREATE INDEX IF NOT EXISTS idx_template_usage_template ON query_template_usage(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usage_success ON query_template_usage(success, rating DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE query_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE popular_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_quality_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interaction_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_query_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refinement_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_template_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suggestion system tables

-- Query suggestions - users can read suggestions from their org, service role can manage all
CREATE POLICY "Users can view suggestions from their organization" ON query_suggestions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all query suggestions" ON query_suggestions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Query templates - users can view public templates and their org's templates, creators can manage their templates
CREATE POLICY "Users can view accessible templates" ON query_templates
    FOR SELECT USING (
        is_public = true OR 
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create templates in their organization" ON query_templates
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        ) AND created_by = auth.uid()
    );

CREATE POLICY "Users can update their own templates" ON query_templates
    FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own templates" ON query_templates
    FOR DELETE USING (created_by = auth.uid());

-- Popular queries - users can view and update their org's popular queries
CREATE POLICY "Users can view popular queries from their organization" ON popular_queries
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update popular queries in their organization" ON popular_queries
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- User query history - users can only access their own history
CREATE POLICY "Users can manage their own query history" ON user_query_history
    FOR ALL USING (user_id = auth.uid());

-- Suggestion analytics - users can view their own analytics, org admins can view org analytics
CREATE POLICY "Users can view their own suggestion analytics" ON suggestion_analytics
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own suggestion analytics" ON suggestion_analytics
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Suggestion feedback - users can manage their own feedback
CREATE POLICY "Users can manage their own suggestion feedback" ON suggestion_feedback
    FOR ALL USING (user_id = auth.uid());

-- Query quality analytics - users can view their own analytics
CREATE POLICY "Users can view their own query quality analytics" ON query_quality_analytics
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own query quality analytics" ON query_quality_analytics
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- User interaction patterns - users can manage their own patterns
CREATE POLICY "Users can manage their own interaction patterns" ON user_interaction_patterns
    FOR ALL USING (user_id = auth.uid());

-- User preferences - users can manage their own preferences
CREATE POLICY "Users can manage their own preferences" ON user_preferences
    FOR ALL USING (user_id = auth.uid());

-- User query interactions - users can manage their own interactions
CREATE POLICY "Users can manage their own query interactions" ON user_query_interactions
    FOR ALL USING (user_id = auth.uid());

-- Refinement performance - readable by all authenticated users, updatable by service
CREATE POLICY "Users can view refinement performance" ON refinement_performance
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service can manage refinement performance" ON refinement_performance
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- AI learning feedback - users can manage their own feedback
CREATE POLICY "Users can manage their own AI learning feedback" ON ai_learning_feedback
    FOR ALL USING (user_id = auth.uid());

-- Suggestion performance - readable by all, updatable by service
CREATE POLICY "Users can view suggestion performance" ON suggestion_performance
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service can manage suggestion performance" ON suggestion_performance
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Query template usage - users can view usage of templates they have access to
CREATE POLICY "Users can view template usage" ON query_template_usage
    FOR SELECT USING (
        user_id = auth.uid() OR
        template_id IN (
            SELECT id FROM query_templates 
            WHERE is_public = true OR organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert their own template usage" ON query_template_usage
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating timestamps
CREATE TRIGGER update_query_suggestions_updated_at BEFORE UPDATE ON query_suggestions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_query_templates_updated_at BEFORE UPDATE ON query_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_popular_queries_updated_at BEFORE UPDATE ON popular_queries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refinement_performance_updated_at BEFORE UPDATE ON refinement_performance 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suggestion_performance_updated_at BEFORE UPDATE ON suggestion_performance 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some initial query suggestions for common HR queries
INSERT INTO query_suggestions (organization_id, text, text_arabic, type, category, confidence, popularity, description, description_arabic, tags, entities) 
SELECT 
    o.id,
    'What are the requirements for employee termination in Saudi Arabia?',
    'ما هي متطلبات إنهاء خدمة الموظف في المملكة العربية السعودية؟',
    'popular',
    'termination',
    0.95,
    85,
    'Common question about termination procedures under Saudi labor law',
    'سؤال شائع حول إجراءات الإنهاء تحت قانون العمل السعودي',
    ARRAY['termination', 'labor law', 'requirements'],
    '[{"text": "termination", "type": "legal_action"}, {"text": "Saudi Arabia", "type": "location"}]'::jsonb
FROM organizations o
ON CONFLICT DO NOTHING;

INSERT INTO query_suggestions (organization_id, text, text_arabic, type, category, confidence, popularity, description, description_arabic, tags, entities) 
SELECT 
    o.id,
    'How to calculate end of service benefits?',
    'كيفية حساب مكافأة نهاية الخدمة؟',
    'popular',
    'benefits',
    0.92,
    78,
    'Frequently asked about calculating end of service benefits',
    'سؤال متكرر حول حساب مكافأة نهاية الخدمة',
    ARRAY['benefits', 'calculation', 'end of service'],
    '[{"text": "end of service benefits", "type": "benefit_type"}, {"text": "calculation", "type": "process"}]'::jsonb
FROM organizations o
ON CONFLICT DO NOTHING;

INSERT INTO query_suggestions (organization_id, text, text_arabic, type, category, confidence, popularity, description, description_arabic, tags, entities) 
SELECT 
    o.id,
    'What is the maximum working hours per week in Saudi Arabia?',
    'ما هو الحد الأقصى لساعات العمل في الأسبوع في المملكة العربية السعودية؟',
    'popular',
    'labor_law',
    0.98,
    92,
    'Basic question about working hours regulations',
    'سؤال أساسي حول أنظمة ساعات العمل',
    ARRAY['working hours', 'labor law', 'regulations'],
    '[{"text": "working hours", "type": "time_duration"}, {"text": "Saudi Arabia", "type": "location"}]'::jsonb
FROM organizations o
ON CONFLICT DO NOTHING;

COMMENT ON TABLE query_suggestions IS 'Stores AI-generated and user-contributed query suggestions for autocomplete and recommendations';
COMMENT ON TABLE query_templates IS 'Pre-built query templates that users can customize with variables';
COMMENT ON TABLE popular_queries IS 'Tracks popular queries per organization for trending suggestions';
COMMENT ON TABLE user_query_history IS 'Stores user query history for personalization';
COMMENT ON TABLE suggestion_analytics IS 'Analytics data for suggestion system performance monitoring';
COMMENT ON TABLE suggestion_feedback IS 'User feedback on suggestion quality and usefulness';
COMMENT ON TABLE query_quality_analytics IS 'Analytics on query quality scores and improvements needed';
COMMENT ON TABLE user_interaction_patterns IS 'Tracks user interaction patterns for better personalization';
COMMENT ON TABLE user_preferences IS 'Stores user preferences for suggestion system customization';
COMMENT ON TABLE user_query_interactions IS 'Tracks user interactions with suggestions (selections, dismissals, etc.)';
COMMENT ON TABLE refinement_performance IS 'Tracks performance of query refinement suggestions';
COMMENT ON TABLE ai_learning_feedback IS 'Feedback data for improving AI suggestion algorithms';
COMMENT ON TABLE suggestion_performance IS 'Performance metrics for individual suggestions';
COMMENT ON TABLE query_template_usage IS 'Tracks usage and success of query templates';