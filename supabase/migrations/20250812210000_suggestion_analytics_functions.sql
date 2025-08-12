-- SQL functions to support suggestion system analytics

-- Function to get daily suggestion metrics
CREATE OR REPLACE FUNCTION get_daily_suggestion_metrics(
    org_id UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    date TEXT,
    total_queries BIGINT,
    refined_queries BIGINT,
    templates_used BIGINT,
    related_questions_clicked BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_metrics AS (
        SELECT 
            DATE(sa.created_at) as metric_date,
            COUNT(*) FILTER (WHERE sa.suggestion_type = ANY(ARRAY['autocomplete', 'popular', 'related'])) as total_queries,
            COUNT(*) FILTER (WHERE sa.suggestion_type = 'refinement') as refined_queries,
            COUNT(*) FILTER (WHERE sa.suggestion_type = 'templates') as templates_used,
            COUNT(*) FILTER (WHERE sa.suggestion_type = 'related') as related_questions_clicked
        FROM suggestion_analytics sa
        WHERE sa.organization_id = org_id
        AND sa.created_at >= start_date
        AND sa.created_at <= end_date
        GROUP BY DATE(sa.created_at)
    )
    SELECT 
        dm.metric_date::TEXT as date,
        dm.total_queries,
        dm.refined_queries,
        dm.templates_used,
        dm.related_questions_clicked
    FROM daily_metrics dm
    ORDER BY dm.metric_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get hourly suggestion distribution
CREATE OR REPLACE FUNCTION get_hourly_suggestion_distribution(
    org_id UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    hour INTEGER,
    queries BIGINT,
    success BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH hourly_metrics AS (
        SELECT 
            EXTRACT(HOUR FROM sa.created_at)::INTEGER as hour_of_day,
            COUNT(*) as total_queries,
            COUNT(*) FILTER (WHERE sa.suggestions_count > 0) as successful_queries
        FROM suggestion_analytics sa
        WHERE sa.organization_id = org_id
        AND sa.created_at >= start_date
        AND sa.created_at <= end_date
        GROUP BY EXTRACT(HOUR FROM sa.created_at)
    ),
    all_hours AS (
        SELECT generate_series(0, 23) as hour_num
    )
    SELECT 
        ah.hour_num as hour,
        COALESCE(hm.total_queries, 0) as queries,
        COALESCE(hm.successful_queries, 0) as success
    FROM all_hours ah
    LEFT JOIN hourly_metrics hm ON ah.hour_num = hm.hour_of_day
    ORDER BY ah.hour_num;
END;
$$ LANGUAGE plpgsql;

-- Function to get suggestion performance metrics by category
CREATE OR REPLACE FUNCTION get_category_suggestion_performance(
    org_id UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    category VARCHAR(20),
    suggestion_count BIGINT,
    avg_response_time NUMERIC,
    cache_hit_rate NUMERIC,
    user_satisfaction NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sa.category,
        COUNT(*) as suggestion_count,
        AVG(sa.response_time)::NUMERIC as avg_response_time,
        (COUNT(*) FILTER (WHERE sa.cache_hit = true)::NUMERIC / COUNT(*) * 100) as cache_hit_rate,
        AVG(COALESCE(sf.helpfulness_rating, 3.5))::NUMERIC as user_satisfaction
    FROM suggestion_analytics sa
    LEFT JOIN suggestion_feedback sf ON sa.user_id = sf.user_id 
        AND sa.suggestion_type = sf.suggestion_type
        AND sa.created_at::DATE = sf.created_at::DATE
    WHERE sa.organization_id = org_id
    AND sa.created_at >= start_date
    AND sa.created_at <= end_date
    AND sa.category IS NOT NULL
    GROUP BY sa.category
    ORDER BY suggestion_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get trending suggestions
CREATE OR REPLACE FUNCTION get_trending_suggestions(
    org_id UUID,
    days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
    text TEXT,
    text_arabic TEXT,
    current_frequency INTEGER,
    previous_frequency INTEGER,
    trend_percentage NUMERIC,
    category VARCHAR(20)
) AS $$
DECLARE
    start_current TIMESTAMP WITH TIME ZONE;
    start_previous TIMESTAMP WITH TIME ZONE;
    end_current TIMESTAMP WITH TIME ZONE;
BEGIN
    end_current := NOW();
    start_current := end_current - (days_back || ' days')::INTERVAL;
    start_previous := start_current - (days_back || ' days')::INTERVAL;
    
    RETURN QUERY
    WITH current_period AS (
        SELECT 
            pq.text,
            pq.text_arabic,
            pq.category,
            pq.frequency as current_freq
        FROM popular_queries pq
        WHERE pq.organization_id = org_id
        AND pq.last_used >= start_current
    ),
    previous_period AS (
        SELECT 
            uqi.query as text,
            uqi.category,
            COUNT(*) as previous_freq
        FROM user_query_interactions uqi
        WHERE uqi.organization_id = org_id
        AND uqi.created_at >= start_previous
        AND uqi.created_at < start_current
        AND uqi.action = 'selected'
        GROUP BY uqi.query, uqi.category
    )
    SELECT 
        cp.text,
        cp.text_arabic,
        cp.current_freq,
        COALESCE(pp.previous_freq, 0)::INTEGER as previous_frequency,
        CASE 
            WHEN COALESCE(pp.previous_freq, 0) = 0 THEN 100.0
            ELSE ((cp.current_freq - COALESCE(pp.previous_freq, 0))::NUMERIC / COALESCE(pp.previous_freq, 1) * 100)
        END as trend_percentage,
        cp.category
    FROM current_period cp
    LEFT JOIN previous_period pp ON cp.text = pp.text AND cp.category = pp.category
    WHERE cp.current_freq > COALESCE(pp.previous_freq, 0)
    ORDER BY trend_percentage DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to get user engagement metrics
CREATE OR REPLACE FUNCTION get_user_engagement_metrics(
    org_id UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    total_users BIGINT,
    active_users BIGINT,
    avg_queries_per_user NUMERIC,
    avg_session_duration NUMERIC,
    return_user_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH user_metrics AS (
        SELECT 
            sa.user_id,
            COUNT(*) as query_count,
            COUNT(DISTINCT DATE(sa.created_at)) as active_days,
            AVG(
                CASE 
                    WHEN uip.session_duration IS NOT NULL THEN uip.session_duration
                    ELSE 300 -- default 5 minutes if no session data
                END
            ) as avg_session_dur
        FROM suggestion_analytics sa
        LEFT JOIN user_interaction_patterns uip ON sa.user_id = uip.user_id 
            AND DATE(sa.created_at) = DATE(uip.timestamp)
        WHERE sa.organization_id = org_id
        AND sa.created_at >= start_date
        AND sa.created_at <= end_date
        GROUP BY sa.user_id
    ),
    returning_users AS (
        SELECT COUNT(DISTINCT user_id) as return_count
        FROM user_metrics
        WHERE active_days > 1
    )
    SELECT 
        COUNT(*)::BIGINT as total_users,
        COUNT(*) FILTER (WHERE query_count >= 3)::BIGINT as active_users,
        AVG(query_count)::NUMERIC as avg_queries_per_user,
        AVG(avg_session_dur)::NUMERIC as avg_session_duration,
        (ru.return_count::NUMERIC / COUNT(*) * 100) as return_user_rate
    FROM user_metrics, returning_users ru;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate suggestion quality scores
CREATE OR REPLACE FUNCTION calculate_suggestion_quality_scores(
    org_id UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    overall_quality_score NUMERIC,
    clarity_score NUMERIC,
    relevance_score NUMERIC,
    usefulness_score NUMERIC,
    accuracy_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH quality_metrics AS (
        SELECT 
            AVG(qqa.clarity_score) as avg_clarity,
            AVG(qqa.specificity_score) as avg_specificity,
            AVG(qqa.completeness_score) as avg_completeness,
            AVG(qqa.grammar_score) as avg_grammar,
            AVG(qqa.terminology_accuracy) as avg_terminology
        FROM query_quality_analytics qqa
        WHERE qqa.organization_id = org_id
        AND qqa.created_at >= start_date
        AND qqa.created_at <= end_date
    ),
    feedback_metrics AS (
        SELECT 
            AVG(
                CASE sf.feedback_type
                    WHEN 'excellent' THEN 5
                    WHEN 'good' THEN 4
                    WHEN 'helpful' THEN 3.5
                    WHEN 'not_helpful' THEN 2
                    WHEN 'poor' THEN 1
                    ELSE 3
                END
            ) as avg_feedback_score,
            COUNT(*) FILTER (WHERE sf.applied_suggestion = true)::NUMERIC / COUNT(*) * 100 as application_rate
        FROM suggestion_feedback sf
        WHERE sf.organization_id = org_id
        AND sf.created_at >= start_date
        AND sf.created_at <= end_date
    )
    SELECT 
        ((qm.avg_clarity + qm.avg_specificity + qm.avg_completeness) / 3 + fm.avg_feedback_score) / 2 as overall_quality_score,
        qm.avg_clarity as clarity_score,
        qm.avg_specificity as relevance_score,
        fm.avg_feedback_score as usefulness_score,
        qm.avg_terminology as accuracy_score
    FROM quality_metrics qm, feedback_metrics fm;
END;
$$ LANGUAGE plpgsql;

-- Function to get template performance analytics
CREATE OR REPLACE FUNCTION get_template_performance_analytics(
    org_id UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    template_id UUID,
    template_name TEXT,
    template_name_arabic TEXT,
    usage_count BIGINT,
    success_rate NUMERIC,
    avg_rating NUMERIC,
    category VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qt.id as template_id,
        qt.name as template_name,
        qt.name_arabic as template_name_arabic,
        COUNT(qtu.id)::BIGINT as usage_count,
        (COUNT(*) FILTER (WHERE qtu.success = true)::NUMERIC / COUNT(*) * 100) as success_rate,
        AVG(qtu.rating)::NUMERIC as avg_rating,
        qt.category
    FROM query_templates qt
    LEFT JOIN query_template_usage qtu ON qt.id = qtu.template_id
        AND qtu.created_at >= start_date
        AND qtu.created_at <= end_date
    WHERE qt.organization_id = org_id
    OR (qt.is_public = true AND EXISTS (
        SELECT 1 FROM query_template_usage qtu2 
        WHERE qtu2.template_id = qt.id 
        AND qtu2.organization_id = org_id
        AND qtu2.created_at >= start_date
        AND qtu2.created_at <= end_date
    ))
    GROUP BY qt.id, qt.name, qt.name_arabic, qt.category
    HAVING COUNT(qtu.id) > 0
    ORDER BY usage_count DESC, avg_rating DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for faster analytics queries
CREATE MATERIALIZED VIEW IF NOT EXISTS suggestion_analytics_summary AS
SELECT 
    DATE(created_at) as date,
    organization_id,
    suggestion_type,
    category,
    language,
    COUNT(*) as total_suggestions,
    AVG(response_time) as avg_response_time,
    COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
    COUNT(*) FILTER (WHERE suggestions_count > 0) as successful_suggestions,
    COUNT(DISTINCT user_id) as unique_users
FROM suggestion_analytics
GROUP BY DATE(created_at), organization_id, suggestion_type, category, language;

-- Index for the materialized view
CREATE INDEX IF NOT EXISTS idx_suggestion_analytics_summary_date_org 
ON suggestion_analytics_summary(date DESC, organization_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_suggestion_analytics_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY suggestion_analytics_summary;
END;
$$ LANGUAGE plpgsql;

-- Create a function that runs daily to refresh analytics
-- This would typically be called by a cron job or scheduled task
CREATE OR REPLACE FUNCTION daily_analytics_maintenance()
RETURNS void AS $$
BEGIN
    -- Refresh materialized view
    PERFORM refresh_suggestion_analytics_summary();
    
    -- Update trending flags in popular_queries
    UPDATE popular_queries 
    SET trending = false, trend_direction = 'stable'
    WHERE trending = true AND last_used < NOW() - INTERVAL '7 days';
    
    -- Archive old analytics data (older than 1 year)
    DELETE FROM suggestion_analytics 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    -- Update suggestion performance metrics
    WITH recent_performance AS (
        SELECT 
            suggestion_text,
            suggestion_type,
            COUNT(*) as interactions,
            AVG(CASE 
                WHEN EXISTS (
                    SELECT 1 FROM suggestion_feedback sf 
                    WHERE sf.selected_question = suggestion_text 
                    AND sf.feedback_type IN ('helpful', 'excellent', 'good')
                ) THEN 1 ELSE 0 
            END) * 100 as selection_rate
        FROM (
            SELECT 
                COALESCE(query, 'unknown') as suggestion_text,
                suggestion_type
            FROM suggestion_analytics sa
            WHERE sa.created_at >= NOW() - INTERVAL '30 days'
        ) recent_suggestions
        GROUP BY suggestion_text, suggestion_type
    )
    INSERT INTO suggestion_performance (
        suggestion_text, 
        suggestion_type, 
        user_interactions, 
        selection_rate,
        created_at,
        updated_at
    )
    SELECT 
        rp.suggestion_text,
        rp.suggestion_type,
        rp.interactions,
        rp.selection_rate,
        NOW(),
        NOW()
    FROM recent_performance rp
    ON CONFLICT (suggestion_text, suggestion_type) 
    DO UPDATE SET
        user_interactions = suggestion_performance.user_interactions + EXCLUDED.user_interactions,
        selection_rate = (suggestion_performance.selection_rate + EXCLUDED.selection_rate) / 2,
        updated_at = NOW();
        
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_daily_suggestion_metrics IS 'Returns daily metrics for suggestion system usage';
COMMENT ON FUNCTION get_hourly_suggestion_distribution IS 'Returns hourly distribution of suggestion queries';
COMMENT ON FUNCTION get_category_suggestion_performance IS 'Returns performance metrics by suggestion category';
COMMENT ON FUNCTION get_trending_suggestions IS 'Returns trending suggestions based on usage growth';
COMMENT ON FUNCTION get_user_engagement_metrics IS 'Returns user engagement metrics for suggestion system';
COMMENT ON FUNCTION calculate_suggestion_quality_scores IS 'Calculates overall quality scores for suggestions';
COMMENT ON FUNCTION get_template_performance_analytics IS 'Returns performance analytics for query templates';
COMMENT ON FUNCTION refresh_suggestion_analytics_summary IS 'Refreshes the suggestion analytics materialized view';
COMMENT ON FUNCTION daily_analytics_maintenance IS 'Daily maintenance tasks for suggestion analytics';