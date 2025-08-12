import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';

interface ConversationPageProps {
  params: {
    id: string;
  };
}

// Loading component for specific conversation
function ConversationLoading() {
  return (
    <div className="flex h-full min-h-[600px] animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 p-4">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded-md"></div>
          <div className="h-6 bg-gray-200 rounded-md w-3/4"></div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded-lg opacity-60"></div>
            ))}
            <div className="h-12 bg-saudi-navy-200 rounded-lg border-2 border-saudi-navy-400"></div>
          </div>
        </div>
      </div>
      
      {/* Chat area with messages skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          {/* Message skeletons */}
          <div className="flex justify-end">
            <div className="max-w-xs bg-gray-200 h-16 rounded-2xl"></div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-md bg-gray-200 h-24 rounded-2xl"></div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-sm bg-gray-200 h-12 rounded-2xl"></div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-lg bg-gray-200 h-32 rounded-2xl"></div>
          </div>
        </div>
        
        {/* Input area skeleton */}
        <div className="border-t p-4">
          <div className="h-12 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const conversationId = params.id;
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    redirect('/chat');
  }

  // Check authentication
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    redirect('/login');
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('users')
    .select(`
      id,
      organization_id,
      organizations:organization_id (
        id,
        name,
        settings
      )
    `)
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    redirect('/auth/organization-setup');
  }

  // Verify conversation exists and belongs to user's organization
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select(`
      id,
      title,
      language,
      status,
      message_count,
      created_at,
      updated_at
    `)
    .eq('id', conversationId)
    .eq('organization_id', profile.organization_id)
    .eq('status', 'active')
    .single();

  if (conversationError || !conversation) {
    // Conversation doesn't exist or doesn't belong to this organization
    redirect('/chat');
  }

  // Detect conversation language for proper RTL/LTR setup
  const isArabic = conversation.language === 'ar';
  const direction = isArabic ? 'rtl' : 'ltr';

  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)]" dir={direction}>
      <Suspense fallback={<ConversationLoading />}>
        <div className="flex w-full">
          {/* Conversation Sidebar */}
          <div className="w-80 shrink-0">
            <ConversationSidebar 
              userId={user.id}
              organizationId={profile.organization_id}
              currentConversationId={conversationId}
            />
          </div>
          
          {/* Main Chat Interface */}
          <div className="flex-1 min-w-0">
            <ChatInterface 
              userId={user.id}
              organizationId={profile.organization_id}
              conversationId={conversationId}
              initialLanguage={conversation.language as 'ar' | 'en'}
              conversationTitle={conversation.title}
            />
          </div>
        </div>
      </Suspense>
    </div>
  );
}