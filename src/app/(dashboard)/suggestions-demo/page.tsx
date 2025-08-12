'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AutocompleteInput } from '@/components/suggestions/AutocompleteInput';
import { RelatedQuestions } from '@/components/suggestions/RelatedQuestions';
import { QueryRefinementComponent } from '@/components/suggestions/QueryRefinement';
import { SuggestionAnalytics } from '@/components/suggestions/SuggestionAnalytics';
import { 
  Search, Sparkles, TrendingUp, BarChart3, Settings, 
  MessageCircle, Globe, RefreshCw, BookOpen, Lightbulb,
  Users, Target, Activity, Zap
} from 'lucide-react';
import { cn } from '@/libs/utils';
import { ConversationMessage } from '@/types/suggestions';

interface DemoPageState {
  currentQuery: string;
  selectedLanguage: 'ar' | 'en' | 'both';
  conversationHistory: ConversationMessage[];
  showAnalytics: boolean;
  selectedQuery: string;
}

export default function SuggestionsDemo() {
  const [state, setState] = useState<DemoPageState>({
    currentQuery: '',
    selectedLanguage: 'both',
    conversationHistory: [],
    showAnalytics: false,
    selectedQuery: ''
  });

  // Sample conversation history for demo
  useEffect(() => {
    setState(prev => ({
      ...prev,
      conversationHistory: [
        {
          id: '1',
          content: 'What are the requirements for employee termination in Saudi Arabia?',
          contentArabic: 'ما هي متطلبات إنهاء خدمة الموظف في المملكة العربية السعودية؟',
          role: 'user',
          timestamp: new Date(Date.now() - 10000).toISOString()
        },
        {
          id: '2',
          content: 'Based on Saudi Labor Law, employee termination requires specific procedures including proper notice periods, documented reasons, and compliance with end-of-service benefit calculations.',
          contentArabic: 'وفقاً لقانون العمل السعودي، يتطلب إنهاء خدمة الموظف إجراءات محددة تشمل فترات إشعار مناسبة، وأسباب موثقة، والامتثال لحسابات مكافأة نهاية الخدمة.',
          role: 'assistant',
          timestamp: new Date(Date.now() - 8000).toISOString()
        }
      ]
    }));
  }, []);

  const handleQueryChange = (query: string) => {
    setState(prev => ({ ...prev, currentQuery: query }));
  };

  const handleQuerySubmit = (query: string) => {
    const newMessage: ConversationMessage = {
      id: Date.now().toString(),
      content: query,
      role: 'user',
      timestamp: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      conversationHistory: [...prev.conversationHistory, newMessage],
      selectedQuery: query
    }));
  };

  const handleQuestionSelect = (question: string) => {
    setState(prev => ({ ...prev, currentQuery: question, selectedQuery: question }));
  };

  const handleRefinementSelect = (refinedQuery: string) => {
    setState(prev => ({ ...prev, currentQuery: refinedQuery }));
  };

  const handleLanguageToggle = () => {
    setState(prev => ({
      ...prev,
      selectedLanguage: prev.selectedLanguage === 'en' ? 'ar' : prev.selectedLanguage === 'ar' ? 'both' : 'en'
    }));
  };

  const sampleQueries = [
    {
      en: "How to calculate end of service benefits?",
      ar: "كيفية حساب مكافأة نهاية الخدمة؟",
      category: "benefits"
    },
    {
      en: "What is the maximum working hours per week?",
      ar: "ما هو الحد الأقصى لساعات العمل في الأسبوع؟",
      category: "labor_law"
    },
    {
      en: "Employee leave policies in Saudi Arabia",
      ar: "سياسات إجازة الموظفين في المملكة العربية السعودية",
      category: "leaves"
    }
  ];

  const isRTL = state.selectedLanguage === 'ar';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Sparkles size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                {state.selectedLanguage === 'ar' 
                  ? 'نظام الاقتراحات الذكية' 
                  : 'Intelligent Suggestion System'
                }
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {state.selectedLanguage === 'ar' 
                  ? 'منصة الذكاء الاصطناعي للموارد البشرية والاستشارات القانونية'
                  : 'AI-Powered HR Intelligence and Legal Consultation Platform'
                }
              </p>
            </div>
          </div>

          {/* Language & Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={handleLanguageToggle}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Globe size={16} />
              {state.selectedLanguage === 'en' ? 'English' : 
               state.selectedLanguage === 'ar' ? 'العربية' : 'Both'}
            </Button>
            
            <Button
              onClick={() => setState(prev => ({ ...prev, showAnalytics: !prev.showAnalytics }))}
              variant="outline"
              className="flex items-center gap-2"
            >
              <BarChart3 size={16} />
              {state.selectedLanguage === 'ar' ? 'التحليلات' : 'Analytics'}
            </Button>
          </div>
        </div>

        {/* Main Search Interface */}
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search size={24} />
              {state.selectedLanguage === 'ar' ? 'البحث الذكي' : 'Smart Search'}
            </CardTitle>
            <CardDescription>
              {state.selectedLanguage === 'ar' 
                ? 'اطرح أسئلتك حول الموارد البشرية وقانون العمل السعودي'
                : 'Ask questions about HR and Saudi labor law'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AutocompleteInput
              value={state.currentQuery}
              onChange={handleQueryChange}
              onSubmit={handleQuerySubmit}
              language={state.selectedLanguage}
              placeholder="Ask about HR policies, labor law, employee benefits..."
              placeholderArabic="اسأل عن سياسات الموارد البشرية، قانون العمل، مزايا الموظفين..."
              maxSuggestions={8}
              includePopular={true}
              includePersonalized={true}
              showRecentQueries={true}
            />

            {/* Sample Queries */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Lightbulb size={16} />
                {state.selectedLanguage === 'ar' ? 'أمثلة للاستعلامات' : 'Sample Queries'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {sampleQueries.map((query, index) => (
                  <Button
                    key={index}
                    onClick={() => handleQueryChange(state.selectedLanguage === 'ar' ? query.ar : query.en)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    {state.selectedLanguage === 'ar' ? query.ar : query.en}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Toggle */}
        {state.showAnalytics ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 size={24} />
                {state.selectedLanguage === 'ar' ? 'تحليلات نظام الاقتراحات' : 'Suggestion System Analytics'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SuggestionAnalytics
                organizationId="demo-org"
                timeRange="week"
                language={state.selectedLanguage}
              />
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="suggestions" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="suggestions" className="flex items-center gap-2">
                <TrendingUp size={16} />
                {state.selectedLanguage === 'ar' ? 'الاقتراحات' : 'Suggestions'}
              </TabsTrigger>
              <TabsTrigger value="refinement" className="flex items-center gap-2">
                <Sparkles size={16} />
                {state.selectedLanguage === 'ar' ? 'التحسين' : 'Refinement'}
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <BookOpen size={16} />
                {state.selectedLanguage === 'ar' ? 'القوالب' : 'Templates'}
              </TabsTrigger>
            </TabsList>

            {/* Related Questions Tab */}
            <TabsContent value="suggestions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle size={20} />
                    {state.selectedLanguage === 'ar' ? 'الأسئلة المرتبطة والمتابعة' : 'Related & Follow-up Questions'}
                  </CardTitle>
                  <CardDescription>
                    {state.selectedLanguage === 'ar' 
                      ? 'اقتراحات ذكية بناءً على سياق المحادثة'
                      : 'Smart suggestions based on conversation context'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RelatedQuestions
                    currentQuery={state.currentQuery || state.selectedQuery || 'employee termination requirements'}
                    conversationHistory={state.conversationHistory}
                    maxSuggestions={6}
                    includeFollowup={true}
                    language={state.selectedLanguage}
                    onQuestionSelect={handleQuestionSelect}
                    showContext={true}
                    autoRefresh={false}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Query Refinement Tab */}
            <TabsContent value="refinement" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles size={20} />
                    {state.selectedLanguage === 'ar' ? 'تحسين الاستعلامات' : 'Query Refinement'}
                  </CardTitle>
                  <CardDescription>
                    {state.selectedLanguage === 'ar' 
                      ? 'تحسين وضوح وفعالية استعلاماتك'
                      : 'Improve clarity and effectiveness of your queries'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <QueryRefinementComponent
                    originalQuery={state.currentQuery || state.selectedQuery || 'how terminate employee'}
                    language={state.selectedLanguage}
                    includeTranslation={true}
                    onRefinementSelect={handleRefinementSelect}
                    showAnalysis={true}
                    showRecommendations={true}
                    autoRefresh={false}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen size={20} />
                    {state.selectedLanguage === 'ar' ? 'قوالب الاستعلامات' : 'Query Templates'}
                  </CardTitle>
                  <CardDescription>
                    {state.selectedLanguage === 'ar' 
                      ? 'قوالب جاهزة للاستعلامات الشائعة'
                      : 'Pre-built templates for common queries'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Sample Template Cards */}
                    <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded">
                            <Users size={16} className="text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {state.selectedLanguage === 'ar' ? 'قالب إنهاء الخدمة' : 'Termination Template'}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {state.selectedLanguage === 'ar' 
                                ? 'قالب شامل لإجراءات إنهاء خدمة الموظفين'
                                : 'Comprehensive template for employee termination procedures'
                              }
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {state.selectedLanguage === 'ar' ? 'إنهاء الخدمة' : 'Termination'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {state.selectedLanguage === 'ar' ? '١٢٣ استخدام' : '123 uses'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded">
                            <Target size={16} className="text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {state.selectedLanguage === 'ar' ? 'قالب المزايا' : 'Benefits Template'}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {state.selectedLanguage === 'ar' 
                                ? 'قالب لحساب وإدارة مزايا الموظفين'
                                : 'Template for calculating and managing employee benefits'
                              }
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {state.selectedLanguage === 'ar' ? 'المزايا' : 'Benefits'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {state.selectedLanguage === 'ar' ? '٨٩ استخدام' : '89 uses'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
                            <Activity size={16} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {state.selectedLanguage === 'ar' ? 'قالب الامتثال' : 'Compliance Template'}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {state.selectedLanguage === 'ar' 
                                ? 'قالب للتحقق من الامتثال القانوني'
                                : 'Template for legal compliance verification'
                              }
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {state.selectedLanguage === 'ar' ? 'الامتثال' : 'Compliance'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {state.selectedLanguage === 'ar' ? '٥٦ استخدام' : '56 uses'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Zap className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold">~150ms</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {state.selectedLanguage === 'ar' ? 'وقت الاستجابة' : 'Response Time'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Target className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-2xl font-bold">94%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {state.selectedLanguage === 'ar' ? 'دقة الاقتراحات' : 'Suggestion Accuracy'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">1.2K+</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {state.selectedLanguage === 'ar' ? 'المستخدمون النشطون' : 'Active Users'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <MessageCircle className="h-8 w-8 text-purple-500" />
              </div>
              <div className="text-2xl font-bold">50K+</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {state.selectedLanguage === 'ar' ? 'الاستعلامات المعالجة' : 'Queries Processed'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-6 w-6 text-blue-500" />
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {state.selectedLanguage === 'ar' 
                  ? 'مدعوم بالذكاء الاصطناعي المتقدم'
                  : 'Powered by Advanced AI'
                }
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              {state.selectedLanguage === 'ar' 
                ? 'يستخدم نظامنا أحدث تقنيات الذكاء الاصطناعي لتقديم اقتراحات دقيقة وفورية، مع دعم كامل للغة العربية وقانون العمل السعودي'
                : 'Our system uses cutting-edge AI technology to provide accurate and instant suggestions, with full support for Arabic language and Saudi labor law'
              }
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}