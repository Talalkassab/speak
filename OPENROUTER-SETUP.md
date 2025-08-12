# OpenRouter Setup Guide for HR Intelligence Platform

## 🚀 **Complete Environment Configuration**

This guide provides comprehensive setup instructions for integrating OpenRouter API with your HR Intelligence Platform, replacing direct OpenAI usage for cost efficiency and model diversity.

## 📋 **Prerequisites**

1. **Active OpenRouter Account**: Sign up at [https://openrouter.ai](https://openrouter.ai)
2. **API Credits**: Purchase at least $10 credits for full functionality
3. **Supabase Project**: Already configured (✅ Complete)
4. **Environment Variables**: Updated configuration required

---

## 🔧 **Step 1: Environment Configuration**

Your `.env.local` file has been updated with the following OpenRouter configuration:

```env
# OpenRouter API Configuration for RAG System
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Default AI Models for RAG System
OPENROUTER_MODEL_EMBEDDING=text-embedding-3-small
OPENROUTER_MODEL_CHAT=openai/gpt-4o
OPENROUTER_MODEL_DOCUMENT_PROCESSING=openai/gpt-4o

# Existing Supabase Configuration (✅ Already Configured)
NEXT_PUBLIC_SUPABASE_URL=https://mpgzgrteyoyspwwsezdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Required Action**: 
Replace `your_openrouter_api_key_here` with your actual OpenRouter API key.

---

## 🎯 **Step 2: OpenRouter Account Setup**

### **2.1 Create OpenRouter Account**
1. Visit [https://openrouter.ai](https://openrouter.ai)
2. Sign up using email or OAuth (Google/GitHub)
3. Verify your email address

### **2.2 Generate API Key**
1. Go to [API Keys page](https://openrouter.ai/keys)
2. Click "Create API Key"
3. Set a descriptive name: "HR Intelligence Platform"
4. **Optional**: Set credit limit for cost control
5. Copy your API key and update `.env.local`

### **2.3 Add Credits**
1. Navigate to [Credits page](https://openrouter.ai/credits)
2. Purchase minimum $10 credits (recommended: $25-50 for testing)
3. **Fee Structure**: 5.5% OpenRouter fee + model provider costs
4. **Payment Options**: Credit card or crypto (5% fee)

---

## 📊 **Step 3: Model Recommendations**

### **🆓 FREE Models for Arabic Language RAG (OPTIMAL CONFIGURATION)**

**🥇 PRIMARY RECOMMENDATION (100% FREE for Chat & Documents):**
- **Chat**: `deepseek/deepseek-chat:free` - Excellent Arabic support, proven in research
- **Documents**: `google/gemini-2.0-flash-exp:free` - 1M token context, multimodal
- **Embeddings**: `text-embedding-3-small` - Only $0.021/1M tokens (minimal cost)

**🥈 ALTERNATIVE FREE OPTIONS:**
- `google/gemini-2.0-flash-exp:free` - Great for multimodal + Arabic
- `deepseek/deepseek-r1-zero:free` - Strong reasoning capabilities
- `deepseek/deepseek-v3-base:free` - Technical document optimization

**💡 SMART FALLBACK STRATEGY:**
- Primary: FREE models (DeepSeek + Gemini)
- Fallback: `openai/gpt-4o-mini` (low cost when free models hit limits)
- Premium: `openai/gpt-4o` (only for complex legal analysis)

### **💰 Updated Cost Analysis (FREE vs PAID)**

| Model | Input Cost | Output Cost | Use Case | Arabic Support |
|-------|------------|-------------|----------|----------------|
| **FREE MODELS** | | | | |
| `deepseek/deepseek-chat:free` | $0.00 | $0.00 | HR Q&A, Chat | ✅ Excellent |
| `google/gemini-2.0-flash-exp:free` | $0.00 | $0.00 | Documents, Multimodal | ✅ Native |
| `deepseek/deepseek-r1-zero:free` | $0.00 | $0.00 | Complex reasoning | ✅ Strong |
| **MINIMAL COST** | | | | |
| text-embedding-3-small | $0.021 | N/A | Embeddings only | ✅ Multilingual |
| **PREMIUM OPTIONS** | | | | |
| openai/gpt-4o-mini | $0.158 | $0.632 | Fallback only | ✅ Strong |
| openai/gpt-4o | $2.64 | $10.55 | Complex legal only | ✅ Excellent |

**🎯 ESTIMATED MONTHLY COSTS (1000 employees):**
- **FREE Configuration**: ~$20-50 (embeddings only)
- **Previous Estimate**: ~$350-800 (95%+ cost reduction!)

---

## 🛠️ **Step 4: Code Integration Status**

### **✅ Already Implemented:**

1. **OpenRouter Client** (`src/libs/services/openrouter-client.ts`)
   - Unified API access to 400+ models
   - Automatic cost calculation
   - Health checks and error handling
   - Arabic-optimized model recommendations

2. **Updated Embedding Service** (`src/libs/services/embedding-service.ts`)
   - Integrated with OpenRouter client
   - Multi-model support
   - Quality validation for Arabic content
   - Intelligent caching system

3. **Environment Configuration**
   - Pre-configured model selections
   - Flexible model switching
   - Cost optimization settings

### **📁 Key Files Updated:**
```
src/libs/services/
├── openrouter-client.ts       # New: OpenRouter integration
├── embedding-service.ts       # Updated: Uses OpenRouter
├── rag-query-service.ts       # Ready for OpenRouter integration
└── response-generation-service.ts  # Ready for OpenRouter integration
```

---

## 🧪 **Step 5: Testing Your Setup**

### **5.1 Health Check**
```typescript
// Test OpenRouter connection
import { openRouterClient } from '@/libs/services/openrouter-client';

const healthStatus = await openRouterClient.healthCheck();
console.log('OpenRouter Status:', healthStatus);
```

### **5.2 Embedding Test**
```typescript
// Test Arabic embedding generation
const embedding = await openRouterClient.generateEmbedding(
  'ما هي حقوق الموظف في نظام العمل السعودي؟',
  { model: 'text-embedding-3-small' }
);
console.log('Embedding generated:', embedding.data.length, 'dimensions');
```

### **5.3 Chat Test**
```typescript
// Test Arabic chat completion
const response = await openRouterClient.generateChatCompletion([
  { role: 'user', content: 'اشرح لي نظام العمل السعودي' }
], { model: 'openai/gpt-4o' });
console.log('Arabic response:', response.data);
```

---

## 📈 **Step 6: Cost Optimization**

### **6.1 Model Selection Strategy**
```env
# Production Recommended Setup
OPENROUTER_MODEL_EMBEDDING=text-embedding-3-small    # $0.021/1M tokens
OPENROUTER_MODEL_CHAT=openai/gpt-4o-mini             # $0.158/1M input
OPENROUTER_MODEL_DOCUMENT_PROCESSING=openai/gpt-4o   # For complex analysis only
```

### **6.2 Usage Monitoring**
- Set up credit alerts in OpenRouter dashboard
- Monitor usage patterns in your application
- Implement request caching (already included)
- Use batch processing for multiple documents

### **6.3 Budget Planning**
**Estimated Monthly Costs for 1000 employees:**
- Embeddings: ~$50-100 (document processing)
- Chat queries: ~$200-500 (user interactions)
- Document processing: ~$100-200 (periodic analysis)
- **Total**: ~$350-800/month

---

## 🔐 **Step 7: Security Best Practices**

### **7.1 API Key Security**
```env
# ❌ Never commit API keys to git
# ❌ Never use API keys in frontend code
# ✅ Store in environment variables only
# ✅ Use different keys for dev/staging/prod
```

### **7.2 Rate Limiting**
- OpenRouter provides automatic rate limiting
- Implement application-level caching
- Use batch operations when possible

### **7.3 Error Handling**
- Graceful fallbacks between models
- Retry logic for transient errors
- Cost tracking and limits

---

## 🚀 **Step 8: Production Deployment**

### **8.1 Environment Variables for Production**
```env
# Production .env
OPENROUTER_API_KEY=or-your-production-key
OPENROUTER_MODEL_EMBEDDING=text-embedding-3-small
OPENROUTER_MODEL_CHAT=openai/gpt-4o-mini
OPENROUTER_MODEL_DOCUMENT_PROCESSING=openai/gpt-4o
```

### **8.2 Monitoring Setup**
1. **OpenRouter Dashboard**: Monitor usage and costs
2. **Application Logging**: Track model performance
3. **Error Tracking**: Implement error monitoring
4. **Cost Alerts**: Set up budget notifications

---

## 📚 **Step 9: Advanced Features**

### **9.1 Model Switching**
```typescript
// Switch models based on complexity
const simpleQuery = await openRouterClient.generateChatCompletion(messages, {
  model: 'openai/gpt-4o-mini'  // Cost-effective for simple queries
});

const complexAnalysis = await openRouterClient.generateChatCompletion(messages, {
  model: 'openai/gpt-4o'  // High-quality for complex analysis
});
```

### **9.2 BYOK (Bring Your Own Key) Option**
- Use your own OpenAI/Anthropic keys through OpenRouter
- 5% OpenRouter fee instead of full markup
- Better rate limits and priority access

### **9.3 Model Recommendations Engine**
```typescript
// Get optimal model for task
const recommendations = openRouterClient.getModelRecommendations();
console.log('Arabic-optimized models:', recommendations.arabicOptimized);
```

---

## ✅ **Verification Checklist**

Before going live, ensure:

- [ ] OpenRouter API key added to `.env.local`
- [ ] Minimum $10 credits purchased
- [ ] Health check passes successfully
- [ ] Arabic embedding generation works
- [ ] Arabic chat completion works
- [ ] Cost monitoring configured
- [ ] Error handling tested
- [ ] Production environment configured

---

## 🆘 **Troubleshooting**

### **Common Issues:**

**1. "API key invalid" error**
```typescript
// Check environment variable loading
console.log('API Key loaded:', !!process.env.OPENROUTER_API_KEY);
```

**2. "Insufficient credits" error**
- Check credit balance in OpenRouter dashboard
- Purchase additional credits

**3. "Model not available" error**
- Verify model name spelling
- Check model availability in OpenRouter dashboard

**4. High costs**
- Review model selection (use gpt-4o-mini for simple tasks)
- Implement better caching
- Monitor token usage patterns

### **Support Resources:**
- OpenRouter Documentation: [https://openrouter.ai/docs](https://openrouter.ai/docs)
- OpenRouter Discord: [https://discord.gg/fVyRaUDgxW](https://discord.gg/fVyRaUDgxW)
- GitHub Issues: For platform-specific issues

---

## 📞 **Next Steps**

1. **Get OpenRouter API Key** → Update `.env.local`
2. **Purchase Credits** → Minimum $10 for testing
3. **Test Integration** → Run health checks
4. **Deploy to Staging** → Verify in staging environment
5. **Monitor Usage** → Set up cost tracking
6. **Go Live** → Deploy to production

Your HR Intelligence Platform is now ready to leverage OpenRouter's powerful AI model ecosystem for cost-effective, high-quality Arabic language processing! 🎉