#!/usr/bin/env node

import { Command } from 'commander';
import { SaudiLawDataLoader } from './load-saudi-law-data';
import { SaudiLawQueryProcessor, QueryContext } from '../libs/saudi-law-query-processor';
import { createClient } from '@supabase/supabase-js';

const program = new Command();

program
  .name('saudi-law-cli')
  .description('CLI tool for managing Saudi Labor Law RAG system')
  .version('1.0.0');

// Load data command
program
  .command('load')
  .description('Load Saudi labor law data into the database')
  .option('-c, --clear', 'Clear existing data before loading')
  .option('-t, --test', 'Run search tests after loading')
  .action(async (options) => {
    try {
      console.log('🚀 Starting data loading...');
      const loader = new SaudiLawDataLoader();
      
      await loader.loadDataset();
      
      if (options.test) {
        console.log('\n🧪 Running search tests...');
        await loader.testSearch('maternity leave rights', 'en');
        await loader.testSearch('حقوق إجازة الأمومة', 'ar');
        await loader.testSearch('end of service calculation', 'en');
      }
      
      console.log('✅ Data loading completed successfully!');
    } catch (error) {
      console.error('❌ Error loading data:', error);
      process.exit(1);
    }
  });

// Query command
program
  .command('query')
  .description('Query the Saudi labor law database')
  .argument('<query>', 'The query to search for')
  .option('-l, --language <lang>', 'Language (ar/en/auto)', 'auto')
  .option('-c, --category <category>', 'Filter by category')
  .option('-n, --limit <number>', 'Number of results to return', '5')
  .action(async (queryText, options) => {
    try {
      const processor = new SaudiLawQueryProcessor();
      
      const context: QueryContext = {
        query: queryText,
        language: options.language as 'ar' | 'en' | 'auto',
        category: options.category
      };
      
      console.log(`🔍 Searching for: "${queryText}"`);
      console.log(`Language: ${options.language}`);
      if (options.category) console.log(`Category: ${options.category}`);
      console.log('');
      
      const result = await processor.processQuery(context);
      
      console.log(`📊 Results Summary:`);
      console.log(`   Articles found: ${result.articles.length}`);
      console.log(`   Confidence: ${result.confidence.toFixed(1)}%`);
      console.log(`   Category: ${result.category}`);
      console.log(`   Language detected: ${result.language}`);
      console.log('');
      
      if (result.articles.length > 0) {
        console.log('📋 Top Articles:');
        result.articles.slice(0, parseInt(options.limit)).forEach((article, index) => {
          const title = result.language === 'ar' ? article.titleAr : article.titleEn;
          const content = result.language === 'ar' ? article.contentAr : article.contentEn;
          
          console.log(`\n${index + 1}. Article ${article.articleNumber}: ${title}`);
          console.log(`   Relevance: ${article.relevanceScore.toFixed(1)}%`);
          console.log(`   Category: ${article.category}`);
          console.log(`   Source: ${article.lawSource}`);
          console.log(`   Content: ${content.substring(0, 200)}...`);
        });
      }
      
      if (result.suggestions.length > 0) {
        console.log('\n💡 Related Questions:');
        result.suggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. ${suggestion}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error processing query:', error);
      process.exit(1);
    }
  });

// Article command
program
  .command('article')
  .description('Get a specific article by number')
  .argument '<number>', 'Article number to retrieve'
  .option('-l, --language <lang>', 'Display language (ar/en)', 'en')
  .action(async (articleNumber, options) => {
    try {
      const processor = new SaudiLawQueryProcessor();
      const article = await processor.getArticleByNumber(articleNumber);
      
      if (!article) {
        console.log(`❌ Article ${articleNumber} not found`);
        return;
      }
      
      const title = options.language === 'ar' ? article.titleAr : article.titleEn;
      const content = options.language === 'ar' ? article.contentAr : article.contentEn;
      
      console.log(`📜 Article ${article.articleNumber}: ${title}`);
      console.log(`Category: ${article.category}`);
      if (article.subcategory) console.log(`Subcategory: ${article.subcategory}`);
      console.log(`Source: ${article.lawSource}`);
      console.log('');
      console.log('Content:');
      console.log(content);
      
      // Show in both languages if requested
      if (options.language === 'en' && article.contentAr) {
        console.log('\n--- Arabic Version ---');
        console.log(`العنوان: ${article.titleAr}`);
        console.log(`المحتوى: ${article.contentAr}`);
      } else if (options.language === 'ar' && article.contentEn) {
        console.log('\n--- English Version ---');
        console.log(`Title: ${article.titleEn}`);
        console.log(`Content: ${article.contentEn}`);
      }
      
    } catch (error) {
      console.error('❌ Error retrieving article:', error);
      process.exit(1);
    }
  });

// Categories command
program
  .command('categories')
  .description('List all available categories with article counts')
  .action(async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase credentials');
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data, error } = await supabase
        .from('saudi_law_articles')
        .select('category')
        .eq('is_active', true);
      
      if (error) throw error;
      
      const categoryCounts: Record<string, number> = {};
      data.forEach(article => {
        categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
      });
      
      console.log('📂 Available Categories:');
      console.log('');
      Object.entries(categoryCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([category, count]) => {
          console.log(`   ${category.padEnd(20)} ${count} articles`);
        });
        
    } catch (error) {
      console.error('❌ Error retrieving categories:', error);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show database and usage statistics')
  .option('-u, --user <userId>', 'Show stats for specific user')
  .action(async (options) => {
    try {
      const processor = new SaudiLawQueryProcessor();
      
      // Get query statistics
      const queryStats = await processor.getQueryStats(options.user);
      
      // Get database statistics
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase credentials');
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: articlesCount } = await supabase
        .from('saudi_law_articles')
        .select('id', { count: 'exact' })
        .eq('is_active', true);
        
      const { data: embeddingsCount } = await supabase
        .from('saudi_law_embeddings')
        .select('id', { count: 'exact' });
        
      const { data: scenariosCount } = await supabase
        .from('hr_scenario_mappings')
        .select('id', { count: 'exact' });
      
      console.log('📊 Saudi Labor Law RAG Statistics');
      console.log('');
      
      console.log('Database Statistics:');
      console.log(`   Active Articles: ${articlesCount?.length || 0}`);
      console.log(`   Total Embeddings: ${embeddingsCount?.length || 0}`);
      console.log(`   HR Scenarios: ${scenariosCount?.length || 0}`);
      console.log('');
      
      if (options.user) {
        console.log(`User Statistics (${options.user}):`);
      } else {
        console.log('Query Statistics (All Users):');
      }
      console.log(`   Total Queries: ${queryStats.totalQueries}`);
      console.log('');
      
      console.log('Top Categories:');
      Object.entries(queryStats.categoryCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([category, count]) => {
          console.log(`   ${category.padEnd(20)} ${count} queries`);
        });
      
      if (Object.keys(queryStats.dailyQueries).length > 0) {
        console.log('');
        console.log('Recent Activity:');
        Object.entries(queryStats.dailyQueries)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 7)
          .forEach(([date, count]) => {
            console.log(`   ${date.padEnd(12)} ${count} queries`);
          });
      }
      
    } catch (error) {
      console.error('❌ Error retrieving statistics:', error);
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Run comprehensive tests on the system')
  .option('--performance', 'Run performance tests')
  .option('--accuracy', 'Run accuracy tests')
  .action(async (options) => {
    try {
      const processor = new SaudiLawQueryProcessor();
      
      console.log('🧪 Running Saudi Labor Law RAG Tests');
      console.log('');
      
      // Basic functionality tests
      const testQueries = [
        { query: 'annual leave days', language: 'en' as const, expectedCategory: 'leave' },
        { query: 'مدة الإجازة السنوية', language: 'ar' as const, expectedCategory: 'leave' },
        { query: 'end of service gratuity calculation', language: 'en' as const, expectedCategory: 'termination' },
        { query: 'ساعات العمل اليومية', language: 'ar' as const, expectedCategory: 'working_hours' },
        { query: 'maternity leave duration', language: 'en' as const, expectedCategory: 'leave' }
      ];
      
      console.log('Testing Basic Queries:');
      let passedTests = 0;
      
      for (const test of testQueries) {
        const startTime = Date.now();
        
        try {
          const result = await processor.processQuery({
            query: test.query,
            language: test.language
          });
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          const passed = result.articles.length > 0 && result.confidence > 50;
          const categoryMatch = result.category === test.expectedCategory;
          
          console.log(`   ${passed ? '✅' : '❌'} "${test.query}"`);
          console.log(`      Articles: ${result.articles.length}, Confidence: ${result.confidence.toFixed(1)}%`);
          console.log(`      Category: ${result.category} ${categoryMatch ? '✅' : '❌'}`);
          console.log(`      Response time: ${duration}ms`);
          
          if (passed) passedTests++;
          
        } catch (error) {
          console.log(`   ❌ "${test.query}" - Error: ${error.message}`);
        }
        
        console.log('');
      }
      
      console.log(`Test Results: ${passedTests}/${testQueries.length} passed`);
      
      if (options.performance) {
        console.log('\nRunning Performance Tests...');
        // Add performance testing logic here
      }
      
      if (options.accuracy) {
        console.log('\nRunning Accuracy Tests...');
        // Add accuracy testing logic here
      }
      
    } catch (error) {
      console.error('❌ Error running tests:', error);
      process.exit(1);
    }
  });

// Database health check
program
  .command('health')
  .description('Check database health and connectivity')
  .action(async () => {
    try {
      console.log('🏥 Checking Saudi Labor Law RAG System Health');
      console.log('');
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      // Check environment variables
      console.log('Environment Variables:');
      console.log(`   Supabase URL: ${supabaseUrl ? '✅' : '❌'}`);
      console.log(`   Service Key: ${supabaseServiceKey ? '✅' : '❌'}`);
      console.log(`   OpenAI Key: ${openaiApiKey ? '✅' : '❌'}`);
      console.log('');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.log('❌ Missing Supabase credentials');
        return;
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Check database connectivity
      console.log('Database Connectivity:');
      try {
        const { data, error } = await supabase.from('saudi_law_articles').select('count', { count: 'exact', head: true });
        console.log(`   Connection: ✅`);
        console.log(`   Articles table: ${error ? '❌' : '✅'}`);
      } catch (error) {
        console.log(`   Connection: ❌ ${error.message}`);
      }
      
      // Check vector extension
      console.log('\nVector Extension:');
      try {
        const { data, error } = await supabase.rpc('exec', { 
          query: "SELECT 1 FROM pg_extension WHERE extname = 'vector';" 
        });
        console.log(`   pgvector: ${error ? '❌' : '✅'}`);
      } catch (error) {
        console.log(`   pgvector: ❌ ${error.message}`);
      }
      
      // Check embeddings
      console.log('\nEmbeddings:');
      try {
        const { data, error } = await supabase.from('saudi_law_embeddings').select('count', { count: 'exact', head: true });
        console.log(`   Embeddings table: ${error ? '❌' : '✅'}`);
      } catch (error) {
        console.log(`   Embeddings table: ❌`);
      }
      
      // Check OpenAI connectivity
      if (openaiApiKey) {
        console.log('\nOpenAI Connectivity:');
        try {
          const processor = new SaudiLawQueryProcessor();
          await processor.processQuery({ query: 'test', language: 'en' });
          console.log(`   API Connection: ✅`);
        } catch (error) {
          console.log(`   API Connection: ❌ ${error.message}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    }
  });

program.parse();