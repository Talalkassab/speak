import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Types for our data structures
interface SaudiLawDataset {
  metadata: {
    version: string;
    lastUpdated: string;
    source: string;
    language: string;
    totalArticles: number;
    disclaimer: string;
  };
  lawSources: Record<string, string>;
  categories: Record<string, string>;
  articles: SaudiLawArticle[];
  commonScenarios: CommonScenario[];
}

interface SaudiLawArticle {
  articleNumber: string;
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
  category: string;
  subcategory?: string;
  lawSource: string;
  chapter?: string;
  effectiveDate?: string;
  keywords: string[];
}

interface CommonScenario {
  scenarioName: string;
  scenarioDescriptionAr: string;
  scenarioDescriptionEn: string;
  keywords: string[];
  relatedArticles: string[];
}

interface EmbeddingData {
  contentType: string;
  textContent: string;
  embedding: number[];
}

class SaudiLawDataLoader {
  private supabase;
  private openai;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    if (!openaiApiKey) {
      throw new Error('Missing OpenAI API key');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  async loadDataset(): Promise<void> {
    console.log('🚀 Starting Saudi Labor Law data loading process...');

    try {
      // Load the dataset
      const datasetPath = path.join(process.cwd(), 'src', 'data', 'saudi-labor-law-dataset.json');
      const dataset: SaudiLawDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

      console.log(`📚 Loaded dataset with ${dataset.articles.length} articles`);

      // Clear existing data
      await this.clearExistingData();

      // Load articles
      await this.loadArticles(dataset.articles);

      // Load scenarios
      await this.loadScenarios(dataset.commonScenarios, dataset.articles);

      // Load common HR queries
      await this.loadCommonQueries();

      console.log('✅ Saudi Labor Law data loading completed successfully!');

    } catch (error) {
      console.error('❌ Error loading Saudi Labor Law data:', error);
      throw error;
    }
  }

  private async clearExistingData(): Promise<void> {
    console.log('🗑️ Clearing existing Saudi law data...');

    // Clear in reverse order due to foreign key constraints
    await this.supabase.from('scenario_article_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('hr_scenario_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('common_hr_queries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('saudi_law_embeddings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('saudi_law_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('✅ Existing data cleared');
  }

  private async loadArticles(articles: SaudiLawArticle[]): Promise<void> {
    console.log('📝 Loading articles and generating embeddings...');

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      console.log(`Processing article ${i + 1}/${articles.length}: ${article.articleNumber}`);

      try {
        // Insert article
        const { data: articleData, error: articleError } = await this.supabase
          .from('saudi_law_articles')
          .insert({
            article_number: article.articleNumber,
            title_ar: article.titleAr,
            title_en: article.titleEn,
            content_ar: article.contentAr,
            content_en: article.contentEn,
            category: article.category,
            subcategory: article.subcategory,
            law_source: article.lawSource,
            chapter: article.chapter,
            effective_date: article.effectiveDate,
            keywords: article.keywords,
            is_active: true
          })
          .select()
          .single();

        if (articleError) throw articleError;

        // Generate embeddings for different content types
        const embeddingsToGenerate = [
          { contentType: 'title_ar', text: article.titleAr },
          { contentType: 'title_en', text: article.titleEn },
          { contentType: 'content_ar', text: article.contentAr },
          { contentType: 'content_en', text: article.contentEn },
          { contentType: 'combined_ar', text: `${article.titleAr}\n\n${article.contentAr}` },
          { contentType: 'combined_en', text: `${article.titleEn}\n\n${article.contentEn}` }
        ];

        // Generate embeddings in batches to avoid rate limits
        for (const { contentType, text } of embeddingsToGenerate) {
          const embedding = await this.generateEmbedding(text);
          
          const { error: embeddingError } = await this.supabase
            .from('saudi_law_embeddings')
            .insert({
              article_id: articleData.id,
              content_type: contentType,
              text_content: text,
              embedding: embedding
            });

          if (embeddingError) throw embeddingError;

          // Small delay to respect rate limits
          await this.delay(100);
        }

        console.log(`✅ Article ${article.articleNumber} processed successfully`);

      } catch (error) {
        console.error(`❌ Error processing article ${article.articleNumber}:`, error);
        throw error;
      }
    }

    console.log('✅ All articles loaded successfully');
  }

  private async loadScenarios(scenarios: CommonScenario[], articles: SaudiLawArticle[]): Promise<void> {
    console.log('📋 Loading HR scenarios...');

    for (const scenario of scenarios) {
      try {
        // Insert scenario
        const { data: scenarioData, error: scenarioError } = await this.supabase
          .from('hr_scenario_mappings')
          .insert({
            scenario_name: scenario.scenarioName,
            scenario_description: `${scenario.scenarioDescriptionEn} / ${scenario.scenarioDescriptionAr}`,
            scenario_keywords: scenario.keywords,
            priority: 5 // Default priority
          })
          .select()
          .single();

        if (scenarioError) throw scenarioError;

        // Map articles to scenario
        for (const articleNumber of scenario.relatedArticles) {
          const article = articles.find(a => a.articleNumber === articleNumber);
          if (!article) {
            console.warn(`⚠️ Article ${articleNumber} not found for scenario ${scenario.scenarioName}`);
            continue;
          }

          // Get article ID
          const { data: articleData, error: articleError } = await this.supabase
            .from('saudi_law_articles')
            .select('id')
            .eq('article_number', articleNumber)
            .single();

          if (articleError || !articleData) {
            console.warn(`⚠️ Could not find article ID for ${articleNumber}`);
            continue;
          }

          // Insert mapping
          const { error: mappingError } = await this.supabase
            .from('scenario_article_mappings')
            .insert({
              scenario_id: scenarioData.id,
              article_id: articleData.id,
              relevance_score: 1.0,
              notes: `Mapped from common scenario: ${scenario.scenarioName}`
            });

          if (mappingError) throw mappingError;
        }

        console.log(`✅ Scenario ${scenario.scenarioName} loaded successfully`);

      } catch (error) {
        console.error(`❌ Error loading scenario ${scenario.scenarioName}:`, error);
        throw error;
      }
    }

    console.log('✅ All scenarios loaded successfully');
  }

  private async loadCommonQueries(): Promise<void> {
    console.log('❓ Loading common HR queries...');

    const commonQueries = [
      {
        queryTextAr: "كيف أحسب مكافأة نهاية الخدمة؟",
        queryTextEn: "How do I calculate end-of-service gratuity?",
        category: "termination",
        answerTemplate: "End-of-service gratuity is calculated based on Article 80 of the Saudi Labor Law..."
      },
      {
        queryTextAr: "كم مدة الإجازة السنوية المستحقة؟",
        queryTextEn: "What is the duration of entitled annual leave?",
        category: "leave",
        answerTemplate: "According to Article 106, annual leave duration depends on years of service..."
      },
      {
        queryTextAr: "ما هي حقوق المرأة الحامل في العمل؟",
        queryTextEn: "What are the rights of pregnant women at work?",
        category: "women_workers",
        answerTemplate: "Pregnant women have specific rights including maternity leave as per Article 117..."
      },
      {
        queryTextAr: "كم ساعات العمل المسموحة يومياً؟",
        queryTextEn: "How many working hours are allowed per day?",
        category: "working_hours",
        answerTemplate: "According to Article 50, working hours must not exceed 8 hours per day..."
      },
      {
        queryTextAr: "متى يمكن إنهاء العقد بدون إشعار؟",
        queryTextEn: "When can a contract be terminated without notice?",
        category: "termination",
        answerTemplate: "Article 77 specifies conditions under which workers can terminate without notice..."
      }
    ];

    for (const query of commonQueries) {
      try {
        const { error } = await this.supabase
          .from('common_hr_queries')
          .insert({
            query_text_ar: query.queryTextAr,
            query_text_en: query.queryTextEn,
            category: query.category,
            answer_template: query.answerTemplate,
            search_count: 0,
            success_rate: 0.0
          });

        if (error) throw error;

      } catch (error) {
        console.error(`❌ Error loading query: ${query.queryTextEn}`, error);
      }
    }

    console.log('✅ Common queries loaded successfully');
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0].embedding;

    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to test the search functionality
  async testSearch(query: string, language: 'ar' | 'en' = 'en'): Promise<void> {
    console.log(`🔍 Testing search for: "${query}" (${language})`);

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Search using our custom function
      const contentTypes = language === 'ar' 
        ? ['content_ar', 'combined_ar'] 
        : ['content_en', 'combined_en'];

      const { data, error } = await this.supabase.rpc('match_saudi_law_articles', {
        query_embedding: queryEmbedding,
        content_types: contentTypes,
        match_threshold: 0.75,
        match_count: 5,
        language_preference: language
      });

      if (error) throw error;

      console.log(`📋 Found ${data.length} relevant articles:`);
      data.forEach((article: any, index: number) => {
        console.log(`${index + 1}. Article ${article.article_number}: ${language === 'ar' ? article.title_ar : article.title_en}`);
        console.log(`   Similarity: ${(article.similarity * 100).toFixed(1)}%`);
        console.log(`   Category: ${article.category}`);
        console.log('');
      });

    } catch (error) {
      console.error('❌ Error testing search:', error);
    }
  }
}

// Main execution function
async function main() {
  const loader = new SaudiLawDataLoader();

  try {
    // Load all data
    await loader.loadDataset();

    // Test the search functionality
    console.log('\n🧪 Testing search functionality...');
    await loader.testSearch('maternity leave rights', 'en');
    await loader.testSearch('حقوق إجازة الأمومة', 'ar');
    await loader.testSearch('end of service calculation', 'en');

  } catch (error) {
    console.error('❌ Main execution error:', error);
    process.exit(1);
  }
}

// Export the class for use in other files
export { SaudiLawDataLoader };

// Run if this file is executed directly
if (require.main === module) {
  main().then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}