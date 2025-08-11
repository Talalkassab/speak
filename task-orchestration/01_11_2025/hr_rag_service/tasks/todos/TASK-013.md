# TASK-013: Build Main Chat Interface Component

**Priority**: P0 (Critical)  
**Phase**: Frontend Development - Day 4  
**Assigned Agent**: `frontend-developer.md`  
**Estimated Time**: 8 hours  
**Dependencies**: TASK-001 (Design System), TASK-009 (Document Upload)  

## Objective
Create the core chat interface component that allows HR professionals to ask questions and receive AI-powered responses combining Saudi labor law with company-specific policies. This is the primary interaction point for the RAG system.

## Acceptance Criteria
- [ ] Clean, professional chat interface with message history
- [ ] Real-time typing indicators and response states
- [ ] Support for Arabic and English input/output
- [ ] Source attribution display for each response
- [ ] Message actions (copy, rate, follow-up)
- [ ] Conversation persistence and history
- [ ] Mobile-responsive design
- [ ] Accessibility compliance (WCAG 2.1 AA)

## Detailed Requirements

### Core Chat Components

#### 1. Main Chat Container (`ChatInterface.tsx`)
```typescript
interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  language: 'ar' | 'en';
  sources?: SourceAttribution[];
  rating?: 1 | 2 | 3 | 4 | 5;
  conversationId: string;
}

interface SourceAttribution {
  type: 'saudi_law' | 'company_policy' | 'template';
  title: string;
  excerpt: string;
  url?: string;
  page?: number;
  confidence: number;
}
```

#### 2. Message List (`MessageList.tsx`)
- Scrollable message history
- Message grouping by conversation
- Auto-scroll to latest message
- Message timestamps with relative time
- Typing indicator during response generation

#### 3. Message Bubble (`MessageBubble.tsx`)
- User messages: Right-aligned, branded colors
- Assistant messages: Left-aligned with source citations
- Arabic RTL message alignment
- Markdown rendering for formatted responses
- Code block syntax highlighting

#### 4. Input Area (`ChatInput.tsx`)
- Multi-line text input with auto-resize
- Send button with loading states
- File attachment support (future)
- Voice input button (placeholder for future)
- Character count and input validation

#### 5. Source Panel (`SourcePanel.tsx`)
- Expandable source attribution display
- Source type icons and labels
- Clickable sources with excerpts
- Confidence scores for each source
- Source document preview modal

### Features & Interactions

#### Message States
1. **Sending**: Show loading spinner on user message
2. **Processing**: Display typing indicator from assistant
3. **Completed**: Full response with sources
4. **Error**: Error message with retry option

#### Language Support
- Automatic language detection for user input
- Response in same language as query
- Language switching option in chat
- RTL text rendering for Arabic content
- Mixed language support (Arabic question, English sources)

#### User Experience
- **Quick Actions**: Copy message, rate response, ask follow-up
- **Conversation Management**: New conversation, history sidebar
- **Search**: Search within conversation history
- **Export**: Export conversation as PDF/DOCX

### UI Layout Structure
```
┌─────────────────────────────────────┐
│ Header: HR Consultant Chat          │
├─────────────────────────────────────┤
│ ┌─────────┐ Message History         │
│ │ History │ ┌─────────────────────┐ │
│ │ Sidebar │ │ Welcome Message     │ │
│ │         │ │                     │ │
│ │ - Conv1 │ │ User: How many...   │ │
│ │ - Conv2 │ │ Assistant: According│ │
│ │ - Conv3 │ │ to Saudi Labor...   │ │
│ │         │ │ Sources: [Law 123]  │ │
│ └─────────┘ │                     │ │
│             └─────────────────────┘ │
├─────────────────────────────────────┤
│ Input: [Type your HR question...]   │
│ [🎤] [📎] [Send]                   │
└─────────────────────────────────────┘
```

### Arabic RTL Considerations
- Message alignment (user RTL right, assistant RTL left)
- Text direction detection and rendering
- Icon positioning for RTL interface
- Timestamp positioning
- Source panel RTL layout

## Technical Specifications

### State Management
```typescript
interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;
  isTyping: boolean;
  language: 'ar' | 'en';
  sidebarOpen: boolean;
}
```

### API Integration
- WebSocket connection for real-time responses (future)
- REST API for message sending/receiving
- Conversation CRUD operations
- Message history pagination
- Source document fetching

### Performance Considerations
- Virtual scrolling for long conversations
- Message pagination (50 messages per page)
- Debounced typing indicators
- Lazy loading of source documents
- Message caching in localStorage

## Integration Points

### Backend APIs (to be created)
```typescript
POST /api/chat/message
GET /api/chat/conversations
GET /api/chat/conversations/:id/messages
POST /api/chat/conversations/:id/rate
```

### Authentication Context
- Organization-scoped conversations
- User role-based message history access
- Message attribution to user

### Document Context
- Integration with uploaded documents
- Reference to document management system
- Source linking to document viewer

## Deliverables
1. `ChatInterface.tsx` - Main chat component
2. `MessageList.tsx` - Message display component
3. `MessageBubble.tsx` - Individual message component
4. `ChatInput.tsx` - Input area component
5. `SourcePanel.tsx` - Source attribution component
6. `ConversationSidebar.tsx` - History sidebar
7. `chat.types.ts` - TypeScript interfaces
8. `useChatState.ts` - Custom hook for state management
9. Chat-specific CSS styles with RTL support
10. Storybook stories for all components

## Testing Criteria
- [ ] Messages send and display correctly
- [ ] Arabic text renders properly in RTL
- [ ] Source attributions display and link correctly
- [ ] Conversation history persists across sessions
- [ ] Error states handle gracefully
- [ ] Loading states provide clear feedback
- [ ] Responsive design works on tablet/mobile
- [ ] Keyboard navigation works properly
- [ ] Screen reader accessibility verified

## Accessibility Requirements
- ARIA labels for all interactive elements
- Keyboard navigation between messages
- Screen reader support for message content
- High contrast mode support
- Focus indicators for all focusable elements

## Mock Data for Development
Create mock conversation data with:
- Sample HR questions in Arabic and English
- Realistic assistant responses
- Saudi law source attributions
- Company policy references
- Rating and timestamp data

## Related Tasks
- Depends on: TASK-001 (Design System)
- Depends on: TASK-009 (Document upload interface)
- Blocks: TASK-042 (Chat API endpoints)
- Related: TASK-014 (Message history sidebar)
- Related: TASK-015 (Source attribution display)

## Future Enhancements (Out of MVP Scope)
- Voice input/output
- File attachment in messages
- Message search and filtering
- Conversation sharing
- Message templates/shortcuts
- Multi-user conversations