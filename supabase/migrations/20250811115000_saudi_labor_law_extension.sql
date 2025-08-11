-- Saudi Labor Law Extension for RAG Service
-- This extends the existing RAG schema with Saudi labor law specific tables

-- Saudi labor law articles table
CREATE TABLE saudi_law_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_number TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_ar TEXT NOT NULL,
  content_en TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g., 'employment', 'termination', 'wages', 'leave'
  subcategory TEXT,
  law_source TEXT NOT NULL, -- 'Labor Law', 'Executive Regulations', 'Ministry Updates'
  chapter TEXT, -- Chapter or section in the law
  effective_date DATE,
  keywords TEXT[], -- Keywords for better searchability
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_number, law_source)
);

-- Saudi law article embeddings (separate table for better performance)
CREATE TABLE saudi_law_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES saudi_law_articles(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('title_ar', 'title_en', 'content_ar', 'content_en', 'combined_ar', 'combined_en')),
  text_content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI embeddings are 1536 dimensions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HR scenario mappings
CREATE TABLE hr_scenario_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name TEXT NOT NULL,
  scenario_description TEXT NOT NULL,
  scenario_keywords TEXT[],
  priority INTEGER DEFAULT 5, -- 1-10 priority for ranking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Many-to-many relationship between scenarios and articles
CREATE TABLE scenario_article_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES hr_scenario_mappings(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES saudi_law_articles(id) ON DELETE CASCADE NOT NULL,
  relevance_score FLOAT DEFAULT 1.0, -- How relevant this article is to the scenario
  notes TEXT, -- Optional notes about the relevance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(scenario_id, article_id)
);

-- Law update tracking
CREATE TABLE law_update_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES saudi_law_articles(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL CHECK (update_type IN ('created', 'modified', 'repealed', 'replaced')),
  old_content_ar TEXT,
  old_content_en TEXT,
  new_content_ar TEXT,
  new_content_en TEXT,
  effective_date DATE,
  source_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Common HR questions/queries for better search optimization
CREATE TABLE common_hr_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text_ar TEXT NOT NULL,
  query_text_en TEXT NOT NULL,
  category TEXT NOT NULL,
  answer_template TEXT,
  relevant_articles UUID[], -- Array of article IDs
  search_count INTEGER DEFAULT 0,
  success_rate FLOAT DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_saudi_law_articles_category ON saudi_law_articles(category);
CREATE INDEX idx_saudi_law_articles_article_number ON saudi_law_articles(article_number);
CREATE INDEX idx_saudi_law_articles_law_source ON saudi_law_articles(law_source);
CREATE INDEX idx_saudi_law_articles_keywords ON saudi_law_articles USING GIN(keywords);
CREATE INDEX idx_saudi_law_articles_active ON saudi_law_articles(is_active) WHERE is_active = true;

CREATE INDEX idx_saudi_law_embeddings_article_id ON saudi_law_embeddings(article_id);
CREATE INDEX idx_saudi_law_embeddings_content_type ON saudi_law_embeddings(content_type);
CREATE INDEX idx_saudi_law_embeddings_embedding ON saudi_law_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_hr_scenario_mappings_keywords ON hr_scenario_mappings USING GIN(scenario_keywords);
CREATE INDEX idx_scenario_article_mappings_scenario_id ON scenario_article_mappings(scenario_id);
CREATE INDEX idx_scenario_article_mappings_article_id ON scenario_article_mappings(article_id);
CREATE INDEX idx_scenario_article_mappings_relevance ON scenario_article_mappings(relevance_score DESC);

CREATE INDEX idx_law_update_history_article_id ON law_update_history(article_id);
CREATE INDEX idx_law_update_history_created_at ON law_update_history(created_at DESC);

CREATE INDEX idx_common_hr_queries_category ON common_hr_queries(category);
CREATE INDEX idx_common_hr_queries_search_count ON common_hr_queries(search_count DESC);

-- Triggers to update timestamps
CREATE TRIGGER update_saudi_law_articles_updated_at BEFORE UPDATE ON saudi_law_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_common_hr_queries_updated_at BEFORE UPDATE ON common_hr_queries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to search Saudi law articles by embedding similarity
CREATE OR REPLACE FUNCTION match_saudi_law_articles(
  query_embedding vector(1536),
  content_types text[] DEFAULT ARRAY['content_ar', 'content_en'],
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  category_filter text DEFAULT NULL,
  language_preference text DEFAULT 'both' -- 'ar', 'en', or 'both'
)
RETURNS TABLE (
  article_id uuid,
  article_number text,
  title_ar text,
  title_en text,
  content_ar text,
  content_en text,
  category text,
  subcategory text,
  law_source text,
  content_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sla.id AS article_id,
    sla.article_number,
    sla.title_ar,
    sla.title_en,
    sla.content_ar,
    sla.content_en,
    sla.category,
    sla.subcategory,
    sla.law_source,
    sle.content_type,
    1 - (sle.embedding <=> query_embedding) AS similarity
  FROM saudi_law_embeddings sle
  JOIN saudi_law_articles sla ON sle.article_id = sla.id
  WHERE 
    sla.is_active = true AND
    (category_filter IS NULL OR sla.category = category_filter) AND
    (content_types IS NULL OR sle.content_type = ANY(content_types)) AND
    (language_preference = 'both' OR 
     (language_preference = 'ar' AND sle.content_type LIKE '%_ar') OR
     (language_preference = 'en' AND sle.content_type LIKE '%_en')) AND
    1 - (sle.embedding <=> query_embedding) > match_threshold
  ORDER BY sle.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get articles by scenario
CREATE OR REPLACE FUNCTION get_articles_by_scenario(
  scenario_name_param text,
  limit_count int DEFAULT 10
)
RETURNS TABLE (
  article_id uuid,
  article_number text,
  title_ar text,
  title_en text,
  content_ar text,
  content_en text,
  category text,
  relevance_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sla.id AS article_id,
    sla.article_number,
    sla.title_ar,
    sla.title_en,
    sla.content_ar,
    sla.content_en,
    sla.category,
    sam.relevance_score
  FROM saudi_law_articles sla
  JOIN scenario_article_mappings sam ON sla.id = sam.article_id
  JOIN hr_scenario_mappings hsm ON sam.scenario_id = hsm.id
  WHERE 
    sla.is_active = true AND
    hsm.scenario_name = scenario_name_param
  ORDER BY sam.relevance_score DESC
  LIMIT limit_count;
END;
$$;

-- Function to update search statistics for common queries
CREATE OR REPLACE FUNCTION update_query_stats(
  query_id uuid,
  was_successful boolean
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE common_hr_queries
  SET 
    search_count = search_count + 1,
    success_rate = CASE 
      WHEN search_count = 0 THEN 
        CASE WHEN was_successful THEN 1.0 ELSE 0.0 END
      ELSE 
        (success_rate * search_count + CASE WHEN was_successful THEN 1.0 ELSE 0.0 END) / (search_count + 1)
    END,
    updated_at = NOW()
  WHERE id = query_id;
END;
$$;