# Saudi Labor Law RAG System - Usage Guide

## Overview

This guide provides comprehensive instructions for using the Saudi Labor Law RAG (Retrieval-Augmented Generation) system. The system enables intelligent search and retrieval of Saudi labor law information with support for both Arabic and English queries.

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Architecture](#system-architecture)
3. [Data Loading](#data-loading)
4. [Query Processing](#query-processing)
5. [API Reference](#api-reference)
6. [Examples](#examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase project with service role key
- OpenAI API key
- TypeScript/JavaScript environment

### Environment Setup

Create a `.env.local` file with the required credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

### Database Setup

1. Apply the RAG service migration:
```bash
npx supabase migration up
```

2. Apply the Saudi law extension:
```bash
# The migration will be applied automatically or manually run:
npx supabase migration up
```

### Data Loading

Load the Saudi labor law dataset:

```bash
npm run load-saudi-law-data
# or
npx ts-node src/scripts/load-saudi-law-data.ts
```

## System Architecture

### Database Schema

The system extends the base RAG schema with Saudi-specific tables:

- `saudi_law_articles`: Core law articles with bilingual content
- `saudi_law_embeddings`: Vector embeddings for semantic search
- `hr_scenario_mappings`: Common HR scenarios linked to articles
- `scenario_article_mappings`: Many-to-many scenario-article relationships
- `common_hr_queries`: Frequently asked questions with templates
- `law_update_history`: Change tracking and versioning

### Components

1. **Data Layer**: Supabase with pgvector extension
2. **Embedding Engine**: OpenAI text-embedding-ada-002
3. **Query Processor**: Smart query analysis and routing
4. **Search Engine**: Hybrid semantic and keyword search
5. **Update System**: Change tracking and version management

## Data Loading

### Loading Saudi Law Data

The `SaudiLawDataLoader` class handles the complete data loading process:

```typescript
import { SaudiLawDataLoader } from './src/scripts/load-saudi-law-data';

const loader = new SaudiLawDataLoader();

// Load complete dataset
await loader.loadDataset();

// Test search functionality
await loader.testSearch('maternity leave rights', 'en');
await loader.testSearch('حقوق إجازة الأمومة', 'ar');
```

### Data Structure

Each article contains:
- Article number and legal references
- Bilingual titles and content (Arabic/English)
- Category and subcategory classification
- Keywords for enhanced searchability
- Effective dates and source references
- Multiple embedding vectors for different content types

## Query Processing

### Using the Query Processor

```typescript
import { SaudiLawQueryProcessor, QueryContext } from './src/libs/saudi-law-query-processor';

const processor = new SaudiLawQueryProcessor();

// Basic query
const context: QueryContext = {
  query: "How many days of annual leave am I entitled to?",
  language: 'auto', // 'ar', 'en', or 'auto'
  userId: 'optional-user-id'
};

const result = await processor.processQuery(context);

console.log(`Found ${result.articles.length} relevant articles`);
console.log(`Confidence: ${result.confidence}%`);
console.log(`Category: ${result.category}`);
```

### Query Types

The system handles various query types:

1. **Information Queries**: "What is the minimum wage?"
2. **Calculation Queries**: "How do I calculate end-of-service gratuity?"
3. **Procedure Queries**: "How do I file a labor complaint?"
4. **Rights Queries**: "What are my maternity leave rights?"
5. **Emergency Queries**: "Can I terminate without notice?"

### Language Support

- **Automatic Detection**: System detects Arabic vs English queries
- **Bilingual Results**: Returns content in both languages
- **Cross-Language Search**: Arabic queries find English content and vice versa
- **Cultural Context**: Understands Saudi-specific terminology

## API Reference

### Core Methods

#### `processQuery(context: QueryContext): Promise<QueryResult>`

Processes a natural language query and returns relevant law articles.

**Parameters:**
- `context.query`: The user's question
- `context.language`: 'ar', 'en', or 'auto'
- `context.userId`: Optional user ID for analytics
- `context.category`: Optional category filter

**Returns:**
```typescript
interface QueryResult {
  articles: LawArticleResult[];
  scenarios: ScenarioResult[];
  confidence: number;
  category: string;
  language: 'ar' | 'en';
  suggestions: string[];
  totalResults: number;
}
```

#### `getArticleByNumber(articleNumber: string): Promise<LawArticleResult | null>`

Retrieves a specific article by its number.

#### `getArticlesByCategory(category: string, limit?: number): Promise<LawArticleResult[]>`

Gets all articles in a specific category.

#### `getQueryStats(userId?: string): Promise<QueryStats>`

Returns analytics about query patterns and usage.

### Database Functions

#### `match_saudi_law_articles()`

Performs vector similarity search on law articles.

```sql
SELECT * FROM match_saudi_law_articles(
  query_embedding := $1,
  content_types := ARRAY['content_en', 'combined_en'],
  match_threshold := 0.78,
  match_count := 5,
  category_filter := 'termination',
  language_preference := 'en'
);
```

#### `get_articles_by_scenario()`

Retrieves articles mapped to a specific HR scenario.

```sql
SELECT * FROM get_articles_by_scenario(
  scenario_name_param := 'contract_termination',
  limit_count := 10
);
```

## Examples

### Basic Search Examples

```typescript
// English query about leave entitlement
const result1 = await processor.processQuery({
  query: "How many days of annual leave do I get after 5 years?",
  language: 'en'
});

// Arabic query about termination
const result2 = await processor.processQuery({
  query: "متى يمكن إنهاء العقد بدون إشعار؟",
  language: 'ar'
});

// Emergency scenario
const result3 = await processor.processQuery({
  query: "I was injured at work, what are my rights?",
  language: 'en',
  urgencyLevel: 'emergency'
});
```

### Category-Specific Searches

```typescript
// Get all termination-related articles
const terminationArticles = await processor.getArticlesByCategory('termination');

// Search within a specific category
const result = await processor.processQuery({
  query: "notice period requirements",
  language: 'en',
  category: 'termination'
});
```

### Getting Specific Articles

```typescript
// Get article by number
const article80 = await processor.getArticleByNumber('80');
if (article80) {
  console.log(article80.titleEn); // "End-of-Service Gratuity"
  console.log(article80.titleAr); // "مكافأة نهاية الخدمة"
}
```

### Analytics and Statistics

```typescript
// Get overall usage statistics
const stats = await processor.getQueryStats();
console.log(`Total queries: ${stats.totalQueries}`);
console.log(`Top categories:`, stats.categoryCounts);

// Get user-specific statistics
const userStats = await processor.getQueryStats('user-id-123');
```

## Best Practices

### Query Optimization

1. **Use Specific Terms**: "maternity leave duration" vs "pregnancy time off"
2. **Include Context**: "Saudi labor law minimum wage" vs "minimum wage"
3. **Try Both Languages**: Some concepts may be better in Arabic or English
4. **Use Legal Terms**: "end-of-service gratuity" vs "severance pay"

### Performance Optimization

1. **Cache Frequent Queries**: Store common query results
2. **Use Appropriate Thresholds**: Balance precision vs recall
3. **Limit Result Counts**: Start with 5-10 results, expand if needed
4. **Monitor Embedding Costs**: Track OpenAI API usage

### Error Handling

```typescript
try {
  const result = await processor.processQuery(context);
  // Handle successful result
} catch (error) {
  if (error.message.includes('embedding')) {
    // Handle OpenAI API errors
  } else if (error.message.includes('Supabase')) {
    // Handle database errors
  } else {
    // Handle other errors
  }
}
```

### Security Considerations

1. **Input Validation**: Sanitize user queries
2. **Rate Limiting**: Implement query limits per user
3. **Access Control**: Restrict sensitive operations
4. **Audit Logging**: Track all queries for compliance

## Troubleshooting

### Common Issues

#### No Results Returned
- **Cause**: Query too specific or threshold too high
- **Solution**: Lower similarity threshold, try broader terms

#### Poor Quality Results
- **Cause**: Query ambiguity or wrong language detection
- **Solution**: Specify language explicitly, use more specific terms

#### Slow Response Times
- **Cause**: Complex queries or database performance
- **Solution**: Optimize queries, add indexes, cache frequent searches

#### Embedding Errors
- **Cause**: OpenAI API issues or rate limits
- **Solution**: Implement retry logic, check API key validity

### Debugging

Enable detailed logging:

```typescript
// Set environment variable
process.env.SAUDI_LAW_DEBUG = 'true';

// Or use console logging
const result = await processor.processQuery(context);
console.log('Query analysis:', result.category);
console.log('Confidence score:', result.confidence);
console.log('Articles found:', result.articles.length);
```

### Performance Monitoring

```typescript
// Monitor query performance
const startTime = Date.now();
const result = await processor.processQuery(context);
const endTime = Date.now();

console.log(`Query took ${endTime - startTime}ms`);
console.log(`Found ${result.articles.length} articles`);
console.log(`Confidence: ${result.confidence}%`);
```

### Database Health Checks

```sql
-- Check embedding index performance
EXPLAIN ANALYZE SELECT * FROM saudi_law_embeddings 
WHERE embedding <-> '[0,0,0...]' < 0.8 
LIMIT 10;

-- Verify data integrity
SELECT category, COUNT(*) FROM saudi_law_articles 
WHERE is_active = true 
GROUP BY category;

-- Check embedding coverage
SELECT 
  sla.category,
  COUNT(sla.id) as articles,
  COUNT(sle.id) as embeddings
FROM saudi_law_articles sla
LEFT JOIN saudi_law_embeddings sle ON sla.id = sle.article_id
GROUP BY sla.category;
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Update Law Content**: Monitor for legal changes
2. **Regenerate Embeddings**: When content is updated
3. **Analyze Query Patterns**: Improve search quality
4. **Performance Optimization**: Monitor and tune database
5. **User Feedback**: Collect and act on user feedback

### Getting Help

- Check the troubleshooting section above
- Review database logs and error messages
- Test with simple queries first
- Verify environment variables and API keys
- Check Supabase dashboard for database issues

For additional support, refer to the Saudi Labor Law documentation and consider consulting with legal experts for content accuracy.