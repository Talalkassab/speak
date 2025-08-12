# 🇸🇦 HR Intelligence Platform - منصة الاستشارات الذكية للموارد البشرية

<p align="center">
  <img src="https://img.shields.io/badge/Arabic%20First-✓-green" />
  <img src="https://img.shields.io/badge/Multi--tenant%20SaaS-✓-blue" />
  <img src="https://img.shields.io/badge/AI%20Powered-✓-purple" />
  <img src="https://img.shields.io/badge/Saudi%20Law%20Ready-✓-red" />
</p>

## 📖 **Project Overview**

**HR Intelligence Platform** is a comprehensive, AI-powered HR consultation SaaS platform designed specifically for Saudi Arabian companies. It provides intelligent HR guidance based on Saudi Labor Law, company policies, and best practices through an advanced RAG (Retrieval-Augmented Generation) system.

### **🎯 Target Market**
- Saudi Arabian HR departments and consultants
- Small to enterprise-scale organizations
- HR professionals seeking Labor Law compliance
- Companies requiring multilingual (Arabic/English) HR support

---

## ✨ **Key Features**

### **🤖 AI-Powered HR Consultation**
- **Arabic-first chat interface** with RTL support
- Real-time streaming responses using OpenRouter API
- Saudi Labor Law integration and expertise
- Document-based Q&A with source attribution
- Multi-tenant data isolation for organizations

### **📁 Document Management System**
- Upload and process HR documents (contracts, policies, procedures)
- Automatic text extraction and Arabic OCR support
- Document chunking and vector embedding generation
- Secure, organization-scoped document storage

### **🏢 Multi-tenant Architecture**
- Organization-level data isolation with Row Level Security (RLS)
- Role-based access control (Admin, HR Manager, Employee)
- Scalable SaaS model supporting unlimited organizations
- Comprehensive audit trails and usage analytics

### **🌐 Bilingual Support**
- Native Arabic (العربية) and English interfaces
- Automatic language detection and switching
- RTL layout optimization for Arabic content
- Cultural sensitivity in Saudi business context

### **💰 Cost-Optimized AI Integration**
- **FREE AI models** prioritized (Google Gemini 2.0 Flash, DeepSeek)
- Smart fallback system for high availability
- 95%+ cost savings vs direct OpenAI usage
- Transparent usage tracking and cost monitoring

---

## 🛠️ **Technology Stack**

### **Frontend**
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling with Arabic fonts
- **Shadcn/ui** - Accessible UI components
- **RTL Support** - Native Arabic text direction

### **Backend & Database**
- **Supabase** - PostgreSQL database with real-time features
- **Row Level Security** - Multi-tenant data isolation
- **pgvector** - Vector similarity search for embeddings
- **Real-time subscriptions** - Live chat updates

### **AI & ML Services**
- **OpenRouter API** - Access to 315+ AI models
- **Google Gemini 2.0 Flash** - Primary free chat model
- **DeepSeek V3** - Alternative free reasoning model
- **text-embedding-3-small** - Cost-effective embeddings

### **Authentication & Payments**
- **Supabase Auth** - User authentication system
- **Stripe** - Subscription management and billing
- **Multi-provider OAuth** - Google, GitHub, email login

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ and npm/bun
- Supabase account and project
- OpenRouter API account
- Stripe account (optional for billing)

### **1. Clone and Install**
```bash
git clone https://github.com/Talalkassab/speak.git
cd speak
npm install
```

### **2. Environment Setup**
```bash
cp .env.local.example .env.local
```

**Required Environment Variables:**
```env
# Supabase Configuration (✅ Pre-configured)
NEXT_PUBLIC_SUPABASE_URL=https://mpgzgrteyoyspwwsezdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter API (⚠️ Add your key)
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# AI Models (✅ Pre-configured for FREE usage)
OPENROUTER_MODEL_CHAT=google/gemini-2.0-flash-exp:free
OPENROUTER_MODEL_DOCUMENT_PROCESSING=google/gemini-2.0-flash-exp:free
OPENROUTER_MODEL_EMBEDDING=text-embedding-3-small
```

### **3. Database Setup**
```bash
# Database migrations are already applied
# Saudi Labor Law schema is pre-configured
npm run dev
```

### **4. Get OpenRouter API Key**
1. Visit [OpenRouter.ai](https://openrouter.ai)
2. Create account and generate API key
3. Add minimum $10 credits (optional - free models available)
4. Update `OPENROUTER_API_KEY` in `.env.local`

### **5. Test the Platform**
```bash
# Run the application
npm run dev

# Test OpenRouter integration
OPENROUTER_API_KEY=your_key npx tsx src/scripts/test-openrouter.ts
```

---

## 🏗️ **Architecture Overview**

### **Multi-tenant Data Model**
```
Organizations
├── Users (HR Managers, Employees)
├── Documents (Contracts, Policies, Procedures)
├── Conversations (Chat History)
├── Document Chunks (Vector Embeddings)
└── Usage Analytics
```

### **RAG System Flow**
1. **Query Processing** - Arabic/English language detection
2. **Vector Search** - Find relevant document chunks
3. **Context Assembly** - Combine documents + Saudi Labor Law
4. **AI Generation** - Generate contextual response
5. **Source Attribution** - Provide document references
6. **Streaming Response** - Real-time chat interface

### **AI Model Hierarchy**
```
Primary: Google Gemini 2.0 Flash (FREE)
├── Fallback 1: DeepSeek V3 (FREE)
├── Fallback 2: GPT-4o-mini (Low Cost)
└── Premium: GPT-4o (Complex Legal Analysis)
```

---

## 📊 **Features Deep Dive**

### **🤖 AI Chat Interface**
- **Arabic RTL Layout** - Native right-to-left text rendering
- **Streaming Responses** - Real-time message generation
- **Source Attribution** - Document reference links
- **Context Awareness** - Conversation history integration
- **Mobile Responsive** - Touch-optimized interface

### **📄 Document Management**
- **File Upload** - PDF, Word, Text document support
- **OCR Processing** - Arabic text extraction with Tesseract.js
- **Smart Chunking** - Semantic document segmentation
- **Vector Embeddings** - Searchable document representations
- **Access Control** - Organization-scoped permissions

### **⚖️ Saudi Labor Law Integration**
- **Complete Law Database** - All articles and regulations
- **Arabic Legal Text** - Native Arabic legal terminology
- **Contextual Citations** - Automatic law reference linking
- **Compliance Guidance** - Best practice recommendations
- **Regular Updates** - Law change notifications

### **🏢 Organization Management**
- **Multi-tenant Isolation** - Secure data separation
- **Role-based Access** - Admin, Manager, Employee roles
- **Usage Analytics** - Chat, document, cost tracking
- **Team Collaboration** - Shared knowledge base
- **Custom Branding** - Organization-specific styling

---

## 💰 **Cost Optimization**

### **FREE Usage Tier**
- **Google Gemini 2.0 Flash** - 100% FREE for chat & documents
- **Rate Limits** - 30 req/min, 1M tokens/day
- **Perfect for** - Small to medium organizations

### **Estimated Monthly Costs**
```
1000 employees using the platform:
├── Chat Queries: 10,000 × $0.012 = $120
├── Document Processing: 1,000 × $0.001 = $1
├── Embeddings: 50,000 × $0.000021 = $1
└── Total: ~$122/month (95% savings vs direct OpenAI)
```

### **Smart Fallback System**
- Automatic model switching on rate limits
- Cost escalation only when necessary
- Usage monitoring and alerts
- Budget controls per organization

---

## 🚀 **Deployment Guide**

### **Production Checklist**
- [ ] OpenRouter API key configured
- [ ] Supabase production database
- [ ] Environment variables secured
- [ ] SSL certificates configured
- [ ] Stripe webhooks (if using billing)
- [ ] Saudi Labor Law database populated
- [ ] Multi-language content verified

### **Environment-specific Configuration**
```bash
# Development
npm run dev

# Staging
npm run build && npm run start

# Production
npm run build
# Deploy to Vercel, Netlify, or your preferred platform
```

---

## 📖 **API Documentation**

### **Chat API**
```typescript
POST /api/v1/chat/stream
{
  "conversationId": "uuid",
  "content": "ما هي حقوق الموظف؟",
  "language": "ar",
  "includeCompanyDocs": true,
  "includeLaborLaw": true
}
```

### **Document API**
```typescript
POST /api/v1/documents/upload
Content-Type: multipart/form-data
{
  "file": File,
  "organizationId": "uuid",
  "category": "policy"
}
```

### **Analytics API**
```typescript
GET /api/v1/analytics/usage
{
  "organizationId": "uuid",
  "dateRange": { "start": "2024-01-01", "end": "2024-01-31" },
  "metrics": ["chats", "documents", "costs"]
}
```

---

## 🔐 **Security & Compliance**

### **Data Protection**
- **Row Level Security** - Database-level access control
- **Data Encryption** - At rest and in transit
- **GDPR Compliance** - User data rights and deletion
- **Audit Logging** - Complete activity tracking
- **Saudi Data Laws** - Local compliance requirements

### **Access Control**
- **Organization Isolation** - Zero data leakage between tenants
- **Role-based Permissions** - Granular access control
- **Session Management** - Secure authentication flows
- **API Rate Limiting** - DDoS and abuse protection

---

## 🎯 **Roadmap & Next Steps**

### **Phase 1: MVP Complete** ✅
- [x] Multi-tenant architecture
- [x] Arabic chat interface
- [x] Document management
- [x] OpenRouter integration
- [x] Saudi Labor Law database
- [x] Cost optimization

### **Phase 2: Enhanced Features** 🚧
- [ ] Advanced analytics dashboard
- [ ] Mobile application (React Native)
- [ ] Voice input/output support
- [ ] Advanced document templates
- [ ] Integration APIs (HRIS systems)
- [ ] White-label customization

### **Phase 3: Enterprise Features** 📋
- [ ] Advanced compliance monitoring
- [ ] Custom AI model training
- [ ] Enterprise SSO integration
- [ ] Advanced workflow automation
- [ ] Multi-language expansion
- [ ] API marketplace integrations

---

## 🤝 **Contributing**

We welcome contributions! Please read our contributing guidelines:

1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open Pull Request**

### **Development Guidelines**
- Follow TypeScript best practices
- Maintain Arabic RTL compatibility
- Test multi-tenant isolation
- Document API changes
- Consider Saudi cultural context

---

## 📞 **Support & Contact**

- **Technical Support** - Create GitHub Issues
- **Business Inquiries** - Contact via project repository
- **Documentation** - See `/docs` folder for detailed guides
- **Community** - Join our discussions in GitHub

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🏆 **Acknowledgments**

- **Supabase** - For excellent BaaS platform
- **OpenRouter** - For cost-effective AI model access
- **Saudi Ministry of Labor** - For Labor Law documentation
- **Next.js Team** - For outstanding React framework
- **Arabic Language Community** - For RTL support and feedback

---

<p align="center">
  <strong>🇸🇦 Built with ❤️ for the Saudi Arabian business community</strong>
  <br />
  <em>منصة ذكية للموارد البشرية - صنعت بحب للمجتمع التجاري السعودي</em>
</p>