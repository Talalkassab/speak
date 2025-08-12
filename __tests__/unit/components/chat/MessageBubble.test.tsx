import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBubble } from '@/components/chat/MessageBubble';

const mockMessage = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  content: 'مرحباً، كيف يمكنني مساعدتك في استفسارات الموارد البشرية؟',
  role: 'assistant' as const,
  created_at: '2025-08-11T10:00:00Z',
  metadata: {
    sources: [
      {
        document_id: 'doc-1',
        title: 'نظام العمل السعودي',
        relevance_score: 0.95,
      },
    ],
    processing_time: 1.2,
  },
};

const mockUserMessage = {
  id: 'msg-2',
  conversation_id: 'conv-1',
  content: 'What are the types of leave available for employees?',
  role: 'user' as const,
  created_at: '2025-08-11T10:01:00Z',
  metadata: {
    language: 'en',
    intent: 'question',
  },
};

// Mock the react-icons
jest.mock('react-icons/hi2', () => ({
  HiClipboardDocument: () => <div data-testid="copy-icon" />,
  HiSpeakerWave: () => <div data-testid="speaker-icon" />,
  HiMicrophone: () => <div data-testid="microphone-icon" />,
}));

// Mock the clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('MessageBubble', () => {
  const mockOnCopy = jest.fn();
  const mockOnSpeak = jest.fn();
  const mockOnRegenerate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders assistant message correctly', () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
      />
    );
    
    expect(screen.getByText(mockMessage.content)).toBeInTheDocument();
    expect(screen.getByTestId('assistant-message')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-avatar')).toBeInTheDocument();
  });

  it('renders user message correctly', () => {
    render(
      <MessageBubble 
        message={mockUserMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
      />
    );
    
    expect(screen.getByText(mockUserMessage.content)).toBeInTheDocument();
    expect(screen.getByTestId('user-message')).toBeInTheDocument();
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
  });

  it('applies correct styling for Arabic text (RTL)', () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
      />
    );
    
    const messageContent = screen.getByTestId('message-content');
    expect(messageContent).toHaveAttribute('dir', 'rtl');
    expect(messageContent).toHaveClass('text-right');
  });

  it('applies correct styling for English text (LTR)', () => {
    render(
      <MessageBubble 
        message={mockUserMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
      />
    );
    
    const messageContent = screen.getByTestId('message-content');
    expect(messageContent).toHaveAttribute('dir', 'ltr');
    expect(messageContent).toHaveClass('text-left');
  });

  it('displays timestamp correctly', () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        showTimestamp={true}
      />
    );
    
    expect(screen.getByTestId('message-timestamp')).toBeInTheDocument();
    // Should show relative time like "2 minutes ago"
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it('shows and hides action buttons on hover', async () => {
    const user = userEvent.setup();
    
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
      />
    );
    
    const messageContainer = screen.getByTestId('message-container');
    
    // Actions should be hidden initially
    expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument();
    
    // Hover over message
    await user.hover(messageContainer);
    
    await waitFor(() => {
      expect(screen.getByTestId('copy-button')).toBeInTheDocument();
      expect(screen.getByTestId('speak-button')).toBeInTheDocument();
    });
    
    // Unhover
    await user.unhover(messageContainer);
    
    await waitFor(() => {
      expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument();
    });
  });

  it('handles copy functionality', async () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        showActions={true}
      />
    );
    
    const copyButton = screen.getByTestId('copy-button');
    fireEvent.click(copyButton);
    
    expect(mockOnCopy).toHaveBeenCalledWith(mockMessage.content);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockMessage.content);
    
    // Should show success feedback
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('handles text-to-speech functionality', () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        showActions={true}
      />
    );
    
    const speakButton = screen.getByTestId('speak-button');
    fireEvent.click(speakButton);
    
    expect(mockOnSpeak).toHaveBeenCalledWith(
      mockMessage.content,
      mockMessage.metadata?.language || 'ar-SA'
    );
  });

  it('displays source references for assistant messages', () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        showSources={true}
      />
    );
    
    expect(screen.getByTestId('message-sources')).toBeInTheDocument();
    expect(screen.getByText('نظام العمل السعودي')).toBeInTheDocument();
    expect(screen.getByText('95% relevance')).toBeInTheDocument();
  });

  it('does not display sources for user messages', () => {
    render(
      <MessageBubble 
        message={mockUserMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        showSources={true}
      />
    );
    
    expect(screen.queryByTestId('message-sources')).not.toBeInTheDocument();
  });

  it('shows processing time for assistant messages', () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        showProcessingTime={true}
      />
    );
    
    expect(screen.getByTestId('processing-time')).toBeInTheDocument();
    expect(screen.getByText('1.2s')).toBeInTheDocument();
  });

  it('handles regenerate functionality for assistant messages', () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        onRegenerate={mockOnRegenerate}
        showActions={true}
      />
    );
    
    const regenerateButton = screen.getByTestId('regenerate-button');
    fireEvent.click(regenerateButton);
    
    expect(mockOnRegenerate).toHaveBeenCalledWith(mockMessage.id);
  });

  it('does not show regenerate button for user messages', () => {
    render(
      <MessageBubble 
        message={mockUserMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        onRegenerate={mockOnRegenerate}
        showActions={true}
      />
    );
    
    expect(screen.queryByTestId('regenerate-button')).not.toBeInTheDocument();
  });

  it('displays loading state for streaming messages', () => {
    const streamingMessage = {
      ...mockMessage,
      isStreaming: true,
      content: 'Partial content...',
    };
    
    render(
      <MessageBubble 
        message={streamingMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
      />
    );
    
    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('typing-animation')).toBeInTheDocument();
  });

  it('supports markdown rendering in message content', () => {
    const markdownMessage = {
      ...mockMessage,
      content: '## العنوان\n\n**نص مهم** و *نص مائل*\n\n- نقطة 1\n- نقطة 2',
    };
    
    render(
      <MessageBubble 
        message={markdownMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        enableMarkdown={true}
      />
    );
    
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('العنوان');
    expect(screen.getByText('نص مهم')).toHaveStyle('font-weight: bold');
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('handles long messages with expand/collapse functionality', async () => {
    const longMessage = {
      ...mockMessage,
      content: 'Lorem ipsum '.repeat(100), // Very long content
    };
    
    render(
      <MessageBubble 
        message={longMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        maxLength={200}
      />
    );
    
    // Should show truncated content initially
    expect(screen.getByTestId('truncated-content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
    
    // Click show more
    fireEvent.click(screen.getByRole('button', { name: /show more/i }));
    
    await waitFor(() => {
      expect(screen.getByTestId('full-content')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
    });
  });

  it('is accessible with proper ARIA attributes', () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
      />
    );
    
    const messageContainer = screen.getByRole('article');
    expect(messageContainer).toHaveAttribute('aria-label', 'Assistant message');
    
    const messageContent = screen.getByTestId('message-content');
    expect(messageContent).toHaveAttribute('aria-live', 'polite');
  });

  it('handles error state when message fails to load', () => {
    const errorMessage = {
      ...mockMessage,
      error: 'Failed to generate response',
      content: '',
    };
    
    render(
      <MessageBubble 
        message={errorMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        onRegenerate={mockOnRegenerate}
      />
    );
    
    expect(screen.getByTestId('message-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to generate response')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('supports custom styling and themes', () => {
    render(
      <MessageBubble 
        message={mockMessage}
        onCopy={mockOnCopy}
        onSpeak={mockOnSpeak}
        theme="dark"
        className="custom-message"
      />
    );
    
    const messageContainer = screen.getByTestId('message-container');
    expect(messageContainer).toHaveClass('custom-message');
    expect(messageContainer).toHaveClass('dark:bg-gray-800'); // Dark theme styling
  });
});