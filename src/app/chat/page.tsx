import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';

// Loading component for chat interface
function ChatLoading() {
  return (
    <div className="flex h-full min-h-[600px] animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 p-4">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded-md"></div>
          <div className="h-6 bg-gray-200 rounded-md w-3/4"></div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main chat area skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6 space-y-4">
          <div className="flex justify-center">
            <div className="h-32 w-32 bg-gray-200 rounded-full"></div>
          </div>
          <div className="text-center space-y-2">
            <div className="h-6 bg-gray-200 rounded-md mx-auto w-48"></div>
            <div className="h-4 bg-gray-200 rounded-md mx-auto w-64"></div>
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

// Main chat page component
export default async function ChatPage() {
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

  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)]" dir="rtl">
      <Suspense fallback={<ChatLoading />}>
        <div className="flex w-full">
          {/* Conversation Sidebar */}
          <div className="w-80 shrink-0">
            <ConversationSidebar 
              userId={user.id}
              organizationId={profile.organization_id}
            />
          </div>
          
          {/* Main Chat Interface */}
          <div className="flex-1 min-w-0">
            <ChatInterface 
              userId={user.id}
              organizationId={profile.organization_id}
              initialLanguage="ar"
            />
          </div>
        </div>
      </Suspense>
    </div>
  );
}