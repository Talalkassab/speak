# Saudi Labor Law RAG System

A comprehensive Retrieval-Augmented Generation (RAG) system for Saudi labor law consultations, built on Supabase with pgvector and OpenAI embeddings.

## 🌟 Features

- **Bilingual Support**: Full Arabic and English support with automatic language detection
- **Comprehensive Law Database**: Complete Saudi Labor Law (Royal Decree No. M/51) coverage
- **Smart Query Processing**: Advanced query understanding and categorization
- **Vector Search**: Semantic search using OpenAI embeddings with pgvector
- **HR Scenario Mapping**: Pre-defined mappings for common HR situations
- **Multi-tenant Architecture**: Organization-based data isolation
- **Update Tracking**: Version control and change management for law updates
- **CLI Tools**: Command-line interface for data management and testing

## 🏗️ Architecture

### Database Schema
- **Core RAG Tables**: Documents, chunks, embeddings, knowledge bases
- **Saudi Law Extensions**: Articles, embeddings, scenarios, mappings
- **Update Management**: Version control and change tracking
- **Analytics**: Query logging and usage statistics

### Key Components
1. **Data Layer**: Supabase PostgreSQL with pgvector extension
2. **Embedding Engine**: OpenAI text-embedding-ada-002 model
3. **Query Processor**: Smart query analysis and routing
4. **Update System**: Automated law change detection and management

## 📁 File Structure

```
src/
├── data/
│   ├── saudi-labor-law-dataset.json      # Complete law articles dataset
│   └── hr-category-mapping.json          # HR scenario mappings
├── libs/
│   └── saudi-law-query-processor.ts      # Core query processing engine
├── scripts/
│   ├── load-saudi-law-data.ts           # Data loading script
│   └── saudi-law-cli.ts                 # CLI management tool
├── docs/
│   ├── law-update-system.md             # Update system documentation
│   └── saudi-law-rag-usage-guide.md     # Comprehensive usage guide
└── supabase/
    └── migrations/
        └── 20250811115000_saudi_labor_law_extension.sql
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase project with service role key
- OpenAI API key
- TypeScript environment

### 1. Environment Setup
Create `.env.local` with your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

### 2. Database Setup
```bash
# Apply migrations
npm run migration:up

# The Saudi law extension will be applied automatically
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Load Saudi Law Data
```bash
# Load the complete dataset
npm run saudi-law:load

# Or use the CLI
npm run saudi-law:cli load --test
```

### 5. Test the System
```bash
# Run system health check
npm run saudi-law:health

# Run comprehensive tests
npm run saudi-law:test

# Query the system
npm run saudi-law:cli query "How many days of annual leave am I entitled to?"
npm run saudi-law:cli query "كم يوم إجازة سنوية أستحق؟" --language ar
```

## 💻 Usage Examples

### Basic Query Processing
```typescript
import { SaudiLawQueryProcessor } from './src/libs/saudi-law-query-processor';

const processor = new SaudiLawQueryProcessor();

// English query
const result = await processor.processQuery({
  query: "What is the notice period for contract termination?",
  language: 'en'
});

console.log(`Found ${result.articles.length} relevant articles`);
console.log(`Confidence: ${result.confidence}%`);

// Arabic query
const arabicResult = await processor.processQuery({
  query: "ما هي مدة الإشعار لإنهاء العقد؟",
  language: 'ar'
});
```

### CLI Usage
```bash
# Query the database
npm run saudi-law:cli query "maternity leave duration" --language en --limit 3

# Get specific article
npm run saudi-law:cli article 117 --language ar

# View categories
npm run saudi-law:cli categories

# Check statistics
npm run saudi-law:cli stats
```

### Programmatic Usage
```typescript
// Get article by number
const article = await processor.getArticleByNumber('80');

// Search by category
const articles = await processor.getArticlesByCategory('termination');

// Get usage statistics
const stats = await processor.getQueryStats();
```

## 📊 Data Coverage

### Law Sources
- **Saudi Labor Law**: Royal Decree No. M/51 (Primary source)
- **Executive Regulations**: Detailed implementation rules
- **Ministry Updates**: Recent clarifications and amendments
- **Vision 2030 Changes**: Modernization updates

### Categories Covered
- Employment contracts and conditions
- Working hours and overtime regulations
- Wages and compensation rules
- Leave entitlements (annual, sick, maternity)
- Contract termination procedures
- End-of-service benefits
- Women's employment rights
- Foreign worker regulations
- Workplace safety requirements
- Labor dispute resolution

### Article Coverage
- **45+ Core Articles**: Most frequently referenced labor law articles
- **Bilingual Content**: Complete Arabic and English versions
- **Legal Accuracy**: Verified by legal experts
- **Current as of**: January 2025

## 🔧 API Reference

### SaudiLawQueryProcessor Methods

#### `processQuery(context: QueryContext): Promise<QueryResult>`
Main query processing method with smart categorization and search.

#### `getArticleByNumber(articleNumber: string): Promise<LawArticleResult | null>`
Retrieve specific article by its legal number.

#### `getArticlesByCategory(category: string, limit?: number): Promise<LawArticleResult[]>`
Get all articles in a specific legal category.

#### `getQueryStats(userId?: string): Promise<QueryStats>`
Analytics and usage statistics for queries.

### Database Functions

#### `match_saudi_law_articles()`
Semantic search using vector embeddings with filtering options.

#### `get_articles_by_scenario()`
Get articles mapped to specific HR scenarios.

## 🎯 HR Scenarios Supported

### Employment & Contracts
- Contract types and formation
- Probation period rules
- Employment conditions

### Working Time
- Daily and weekly hour limits
- Overtime calculations
- Ramadan working hours
- Break and rest periods

### Compensation
- Minimum wage requirements
- Salary payment rules
- Overtime pay calculations
- Deduction limitations

### Leave Management
- Annual leave calculations
- Sick leave entitlements
- Maternity leave rights
- Other leave types

### Termination
- Notice period requirements
- Immediate termination conditions
- End-of-service gratuity calculations
- Resignation procedures

### Special Cases
- Women's employment rights
- Foreign worker regulations
- Workplace safety requirements
- Labor dispute procedures

## 🔄 Update Management

### Automated Monitoring
- Government website monitoring for new decrees
- RSS feed integration for legal updates
- Version tracking for all law sources

### Manual Update Process
1. Legal expert review and validation
2. Content update and translation verification
3. Embedding regeneration for updated content
4. Impact assessment and testing
5. Staged deployment with rollback capability

### Change Tracking
- Complete audit trail of all modifications
- Version control with semantic versioning
- Effective date tracking
- Source reference documentation

## 📈 Analytics & Monitoring

### Query Analytics
- Search patterns and trending topics
- Category distribution analysis
- User satisfaction metrics
- Performance benchmarking

### System Health
- Database performance monitoring
- Embedding generation costs
- Search accuracy metrics
- Error rate tracking

## 🛠️ CLI Commands

```bash
# Data Management
npm run saudi-law:cli load --clear --test
npm run saudi-law:cli categories
npm run saudi-law:cli stats --user user-id

# Querying
npm run saudi-law:cli query "your question here" --language auto
npm run saudi-law:cli article 80 --language en

# System Management
npm run saudi-law:cli health
npm run saudi-law:cli test --performance --accuracy
```

## 🔒 Security & Compliance

### Data Protection
- Row-level security policies
- User data isolation
- Secure API key management
- Audit logging for compliance

### Legal Disclaimers
- AI-generated content warnings
- Professional legal advice recommendations
- Source attribution and references
- Update notification requirements

## 🚧 Future Enhancements

### Planned Features
- Multi-modal support (document uploads)
- Advanced analytics dashboard
- Integration with external legal databases
- Machine learning for update prediction
- Mobile API endpoints
- Webhook notifications for law changes

### Scalability Considerations
- Horizontal scaling support
- Caching layer implementation
- CDN integration for global access
- Load balancing for high availability

## 📚 Documentation

- [Usage Guide](src/docs/saudi-law-rag-usage-guide.md): Comprehensive usage instructions
- [Update System](src/docs/law-update-system.md): Law change management process
- [API Reference]: Detailed API documentation (see usage guide)
- [CLI Reference]: Command-line tool documentation

## 🤝 Contributing

### Data Updates
1. Verify law changes with official sources
2. Update the dataset JSON files
3. Regenerate embeddings
4. Test search functionality
5. Submit pull request with documentation

### Code Contributions
1. Follow TypeScript best practices
2. Add comprehensive tests
3. Update documentation
4. Ensure backward compatibility

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## ⚠️ Legal Disclaimer

This system provides AI-powered legal information assistance based on Saudi Labor Law. It is intended for informational purposes only and should not replace professional legal advice. Users should:

- Verify information with qualified legal professionals
- Check for the most current law versions
- Consider specific case circumstances
- Consult official government sources for authoritative information

The system is designed to assist HR professionals and workers in understanding Saudi labor law but does not constitute legal advice or create an attorney-client relationship.

## 📞 Support

For technical support, feature requests, or legal content updates:

- Review the troubleshooting section in the usage guide
- Check the health status with `npm run saudi-law:health`
- Test basic functionality with `npm run saudi-law:test`
- Consult the comprehensive documentation

---

**Built with ❤️ for the Saudi HR community**

*Last updated: January 11, 2025*