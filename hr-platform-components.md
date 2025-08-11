# HR Platform-Specific Component Specifications

## Overview
This document provides detailed specifications for components unique to the HR Business Consultant RAG platform. These components are designed for Saudi Arabian businesses and support both Arabic and English languages with appropriate cultural considerations.

## Table of Contents
1. [Chat Interface Components](#chat-interface-components)
2. [Document Upload Components](#document-upload-components)
3. [Compliance Status Components](#compliance-status-components)
4. [Source Attribution Components](#source-attribution-components)
5. [Dashboard Widgets](#dashboard-widgets)
6. [Legal Reference Components](#legal-reference-components)
7. [User Query History](#user-query-history)
8. [Arabic Text Processing Components](#arabic-text-processing-components)

---

## Chat Interface Components

### 1. Chat Container
The main chat interface for HR consultations.

#### Specifications
```typescript
interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onSendMessage: (message: string, attachments?: File[]) => void;
  onClearChat?: () => void;
  placeholder?: string;
  maxHeight?: string;
  showAttachments?: boolean;
  language?: 'ar' | 'en';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SourceReference[];
  attachments?: ChatAttachment[];
  status?: 'sending' | 'sent' | 'error';
}
```

#### Visual Design
```css
.chat-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  background: white;
  border: 1px solid var(--professional-200);
  border-radius: 12px;
  overflow: hidden;
}

/* Header */
.chat-header {
  padding: 16px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--professional-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--professional-900);
}

[dir="rtl"] .chat-title {
  font-family: var(--font-arabic);
}

/* Messages area */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Input area */
.chat-input-area {
  padding: 16px 24px;
  border-top: 1px solid var(--professional-200);
  background: var(--bg-primary);
}
```

### 2. Message Bubble
Individual chat message display with RTL support.

#### Specifications
```typescript
interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showTimestamp?: boolean;
  showSources?: boolean;
  language?: 'ar' | 'en';
}
```

#### Visual Design
```css
/* Base message bubble */
.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  word-wrap: break-word;
  font-size: 1rem;
  line-height: 1.5;
  position: relative;
}

/* User messages */
.message-bubble--user {
  background: var(--saudi-navy);
  color: white;
  margin-left: auto;
}

[dir="ltr"] .message-bubble--user {
  border-bottom-right-radius: 4px;
}

[dir="rtl"] .message-bubble--user {
  border-bottom-left-radius: 4px;
  margin-left: 0;
  margin-right: auto;
}

/* Assistant messages */
.message-bubble--assistant {
  background: var(--professional-100);
  color: var(--professional-900);
  margin-right: auto;
}

[dir="ltr"] .message-bubble--assistant {
  border-bottom-left-radius: 4px;
}

[dir="rtl"] .message-bubble--assistant {
  border-bottom-right-radius: 4px;
  margin-right: 0;
  margin-left: auto;
}

/* Arabic text styling */
[dir="rtl"] .message-bubble {
  font-size: 1.125rem;
  line-height: 1.625;
  text-align: right;
}

/* Timestamp */
.message-timestamp {
  font-size: 0.75rem;
  color: var(--professional-400);
  margin-top: 4px;
  text-align: center;
}
```

### 3. Chat Input with Attachments
Enhanced input field supporting text and file uploads.

#### Specifications
```typescript
interface ChatInputProps {
  onSend: (message: string, attachments?: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  allowAttachments?: boolean;
  maxAttachmentSize?: number; // in MB
  acceptedFileTypes?: string[];
  language?: 'ar' | 'en';
}
```

#### Visual Design
```css
.chat-input-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.chat-input {
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: 12px 16px;
  border: 2px solid var(--professional-200);
  border-radius: 24px;
  resize: none;
  font-size: 1rem;
  line-height: 1.5;
  transition: border-color 0.2s ease;
  background: white;
}

.chat-input:focus {
  border-color: var(--saudi-navy);
  outline: none;
  box-shadow: 0 0 0 3px rgba(26, 54, 93, 0.1);
}

[dir="rtl"] .chat-input {
  text-align: right;
  font-size: 1.125rem;
  line-height: 1.625;
}

/* Send button */
.chat-send-button {
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  background: var(--saudi-navy);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.chat-send-button:hover {
  background: var(--saudi-navy-light);
  transform: translateY(-1px);
}

.chat-send-button:disabled {
  background: var(--professional-300);
  cursor: not-allowed;
  transform: none;
}

/* Attachment button */
.attachment-button {
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  background: var(--professional-100);
  color: var(--professional-600);
  border: 2px solid var(--professional-200);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.attachment-button:hover {
  background: var(--professional-200);
  color: var(--professional-700);
}
```

---

## Document Upload Components

### 1. Drag & Drop Upload Area
Specialized for legal documents with Arabic support.

#### Specifications
```typescript
interface DocumentUploadProps {
  onUpload: (files: File[]) => void;
  acceptedTypes: string[];
  maxSize: number; // in MB
  maxFiles?: number;
  title?: string;
  subtitle?: string;
  language?: 'ar' | 'en';
  isUploading?: boolean;
  progress?: number;
}
```

#### Visual Design
```css
.document-upload-area {
  border: 2px dashed var(--professional-300);
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
  cursor: pointer;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.document-upload-area:hover {
  border-color: var(--saudi-navy);
  background: rgba(26, 54, 93, 0.02);
}

.document-upload-area.drag-active {
  border-color: var(--saudi-navy);
  background: rgba(26, 54, 93, 0.05);
  border-style: solid;
}

.document-upload-area.uploading {
  pointer-events: none;
  opacity: 0.7;
}

/* Upload icon */
.upload-icon {
  width: 48px;
  height: 48px;
  color: var(--professional-400);
  margin-bottom: 16px;
}

.document-upload-area:hover .upload-icon,
.document-upload-area.drag-active .upload-icon {
  color: var(--saudi-navy);
}

/* Text content */
.upload-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--professional-900);
  margin-bottom: 8px;
}

[dir="rtl"] .upload-title {
  font-family: var(--font-arabic);
}

.upload-subtitle {
  font-size: 0.875rem;
  color: var(--professional-600);
  line-height: 1.5;
}

[dir="rtl"] .upload-subtitle {
  font-size: 1rem;
  line-height: 1.625;
}

/* Progress bar */
.upload-progress {
  width: 100%;
  height: 4px;
  background: var(--professional-200);
  border-radius: 2px;
  overflow: hidden;
}

.upload-progress-bar {
  height: 100%;
  background: var(--saudi-navy);
  transition: width 0.3s ease;
}
```

### 2. File List Display
Shows uploaded files with processing status.

#### Specifications
```typescript
interface FileListProps {
  files: UploadedFile[];
  onRemove?: (fileId: string) => void;
  onPreview?: (fileId: string) => void;
  language?: 'ar' | 'en';
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  progress?: number;
  error?: string;
}
```

#### Visual Design
```css
.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border: 1px solid var(--professional-200);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.file-item:hover {
  border-color: var(--professional-300);
}

/* File icon */
.file-icon {
  width: 32px;
  height: 32px;
  color: var(--saudi-navy);
}

/* File info */
.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: var(--professional-900);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  font-size: 0.75rem;
  color: var(--professional-500);
  display: flex;
  gap: 8px;
}

[dir="rtl"] .file-info {
  text-align: right;
}

/* Status indicator */
.file-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge--uploading {
  background: var(--compliance-pending);
  color: white;
}

.status-badge--processing {
  background: var(--compliance-warning);
  color: white;
}

.status-badge--ready {
  background: var(--compliance-success);
  color: white;
}

.status-badge--error {
  background: var(--compliance-error);
  color: white;
}

/* Action buttons */
.file-actions {
  display: flex;
  gap: 4px;
}

.file-action-button {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--professional-500);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.file-action-button:hover {
  background: var(--professional-100);
  color: var(--professional-700);
}
```

---

## Compliance Status Components

### 1. Compliance Badge
Indicates compliance status for various HR elements.

#### Specifications
```typescript
interface ComplianceBadgeProps {
  status: 'compliant' | 'non-compliant' | 'pending' | 'under-review' | 'needs-attention';
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  language?: 'ar' | 'en';
}
```

#### Visual Design
```css
.compliance-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

[dir="rtl"] .compliance-badge {
  font-size: 1rem;
}

/* Size variants */
.compliance-badge--sm {
  padding: 4px 8px;
  font-size: 0.75rem;
}

.compliance-badge--md {
  padding: 6px 12px;
  font-size: 0.875rem;
}

.compliance-badge--lg {
  padding: 8px 16px;
  font-size: 1rem;
}

/* Status variants */
.compliance-badge--compliant {
  background: var(--compliance-success);
  color: white;
}

.compliance-badge--non-compliant {
  background: var(--compliance-error);
  color: white;
}

.compliance-badge--pending {
  background: var(--compliance-pending);
  color: white;
}

.compliance-badge--under-review {
  background: var(--compliance-warning);
  color: white;
}

.compliance-badge--needs-attention {
  background: var(--saudi-gold);
  color: white;
}

/* Icon */
.compliance-icon {
  width: 14px;
  height: 14px;
}
```

### 2. Compliance Score Card
Displays overall compliance metrics.

#### Specifications
```typescript
interface ComplianceScoreProps {
  score: number; // 0-100
  totalItems: number;
  compliantItems: number;
  nonCompliantItems: number;
  pendingItems: number;
  title?: string;
  language?: 'ar' | 'en';
}
```

#### Visual Design
```css
.compliance-score-card {
  background: white;
  border: 1px solid var(--professional-200);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.compliance-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.compliance-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--professional-900);
}

[dir="rtl"] .compliance-title {
  font-family: var(--font-arabic);
}

/* Score circle */
.compliance-score-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: conic-gradient(
    var(--compliance-success) var(--score-percentage, 0%),
    var(--professional-200) 0%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.compliance-score-circle::before {
  content: '';
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: white;
  position: absolute;
}

.compliance-score-text {
  position: relative;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--professional-900);
}

/* Metrics breakdown */
.compliance-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.compliance-metric {
  text-align: center;
}

.compliance-metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.compliance-metric-label {
  font-size: 0.875rem;
  color: var(--professional-600);
}

[dir="rtl"] .compliance-metric-label {
  font-size: 1rem;
}

.compliance-metric--compliant .compliance-metric-value {
  color: var(--compliance-success);
}

.compliance-metric--error .compliance-metric-value {
  color: var(--compliance-error);
}

.compliance-metric--pending .compliance-metric-value {
  color: var(--compliance-warning);
}
```

### 3. Compliance Timeline
Shows compliance status changes over time.

#### Specifications
```typescript
interface ComplianceTimelineProps {
  events: ComplianceEvent[];
  language?: 'ar' | 'en';
}

interface ComplianceEvent {
  id: string;
  title: string;
  description?: string;
  status: 'compliant' | 'non-compliant' | 'pending';
  timestamp: Date;
  details?: string[];
}
```

#### Visual Design
```css
.compliance-timeline {
  position: relative;
  padding-left: 32px;
}

[dir="rtl"] .compliance-timeline {
  padding-left: 0;
  padding-right: 32px;
}

/* Timeline line */
.compliance-timeline::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--professional-200);
}

[dir="rtl"] .compliance-timeline::before {
  left: auto;
  right: 16px;
}

.compliance-timeline-item {
  position: relative;
  margin-bottom: 24px;
  background: white;
  border: 1px solid var(--professional-200);
  border-radius: 8px;
  padding: 16px;
}

/* Timeline dot */
.compliance-timeline-item::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 20px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  background: var(--professional-400);
}

[dir="rtl"] .compliance-timeline-item::before {
  left: auto;
  right: -24px;
}

.compliance-timeline-item--compliant::before {
  background: var(--compliance-success);
}

.compliance-timeline-item--error::before {
  background: var(--compliance-error);
}

.compliance-timeline-item--pending::before {
  background: var(--compliance-warning);
}

.timeline-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.timeline-item-title {
  font-weight: 600;
  color: var(--professional-900);
}

[dir="rtl"] .timeline-item-title {
  font-family: var(--font-arabic);
}

.timeline-item-timestamp {
  font-size: 0.75rem;
  color: var(--professional-500);
}

.timeline-item-description {
  color: var(--professional-700);
  line-height: 1.5;
  margin-bottom: 12px;
}

[dir="rtl"] .timeline-item-description {
  line-height: 1.625;
}

.timeline-item-details {
  list-style: none;
  padding: 0;
  margin: 0;
}

.timeline-item-details li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 0.875rem;
  color: var(--professional-600);
}

[dir="rtl"] .timeline-item-details li {
  font-size: 1rem;
}
```

---

## Source Attribution Components

### 1. Source Reference Card
Displays the source of information with legal document details.

#### Specifications
```typescript
interface SourceReferenceProps {
  source: SourceInfo;
  showPreview?: boolean;
  language?: 'ar' | 'en';
}

interface SourceInfo {
  id: string;
  title: string;
  type: 'law' | 'regulation' | 'policy' | 'procedure' | 'case-study';
  source: string; // e.g., "Saudi Labor Law", "Company Policy"
  section?: string;
  page?: number;
  url?: string;
  relevanceScore?: number;
  lastUpdated?: Date;
}
```

#### Visual Design
```css
.source-reference-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--professional-200);
  border-radius: 8px;
  padding: 16px;
  margin-top: 12px;
  transition: all 0.2s ease;
}

.source-reference-card:hover {
  border-color: var(--saudi-navy);
  box-shadow: 0 2px 4px rgba(26, 54, 93, 0.1);
}

.source-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.source-type-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
  text-transform: uppercase;
}

.source-type-badge--law {
  background: var(--saudi-navy);
}

.source-type-badge--regulation {
  background: var(--compliance-warning);
}

.source-type-badge--policy {
  background: var(--saudi-green);
}

.source-type-badge--procedure {
  background: var(--compliance-pending);
}

.source-type-badge--case-study {
  background: var(--saudi-gold);
}

.source-title {
  font-weight: 600;
  color: var(--saudi-navy);
  margin-bottom: 4px;
  line-height: 1.3;
}

[dir="rtl"] .source-title {
  font-family: var(--font-arabic);
  line-height: 1.5;
}

.source-details {
  font-size: 0.875rem;
  color: var(--professional-600);
  line-height: 1.4;
}

[dir="rtl"] .source-details {
  font-size: 1rem;
  line-height: 1.625;
}

.source-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--professional-200);
  font-size: 0.75rem;
  color: var(--professional-500);
}

[dir="rtl"] .source-meta {
  font-size: 0.875rem;
}

.relevance-score {
  display: flex;
  align-items: center;
  gap: 4px;
}

.relevance-stars {
  color: var(--saudi-gold);
}

.source-actions {
  display: flex;
  gap: 8px;
}

.source-action-button {
  padding: 6px 12px;
  border: 1px solid var(--professional-300);
  background: white;
  color: var(--professional-600);
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.source-action-button:hover {
  border-color: var(--saudi-navy);
  color: var(--saudi-navy);
}
```

### 2. Sources Summary
Aggregated view of all sources used in a consultation.

#### Specifications
```typescript
interface SourcesSummaryProps {
  sources: SourceInfo[];
  totalSources: number;
  groupBy?: 'type' | 'source' | 'relevance';
  language?: 'ar' | 'en';
}
```

#### Visual Design
```css
.sources-summary {
  background: white;
  border: 1px solid var(--professional-200);
  border-radius: 12px;
  padding: 20px;
}

.sources-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--professional-200);
}

.sources-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--professional-900);
}

[dir="rtl"] .sources-title {
  font-family: var(--font-arabic);
}

.sources-count {
  font-size: 0.875rem;
  color: var(--professional-600);
  background: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 12px;
}

.sources-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.source-group {
  border: 1px solid var(--professional-200);
  border-radius: 8px;
  padding: 16px;
}

.source-group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.source-group-title {
  font-weight: 600;
  color: var(--professional-900);
}

.source-group-count {
  font-size: 0.75rem;
  color: var(--professional-500);
  background: var(--professional-100);
  padding: 2px 6px;
  border-radius: 8px;
}

.source-group-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-group-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.source-group-item:hover {
  background: var(--bg-secondary);
}

.source-item-title {
  flex: 1;
  font-size: 0.875rem;
  color: var(--professional-700);
}

[dir="rtl"] .source-item-title {
  font-size: 1rem;
  text-align: right;
}

.source-item-relevance {
  font-size: 0.75rem;
  color: var(--professional-500);
}
```

---

## Dashboard Widgets

### 1. Recent Consultations Widget
Shows recent HR consultations with status.

#### Specifications
```typescript
interface RecentConsultationsProps {
  consultations: Consultation[];
  onViewAll?: () => void;
  language?: 'ar' | 'en';
}

interface Consultation {
  id: string;
  title: string;
  category: string;
  status: 'completed' | 'in-progress' | 'pending';
  timestamp: Date;
  messagesCount: number;
}
```

#### Visual Design
```css
.recent-consultations-widget {
  background: white;
  border: 1px solid var(--professional-200);
  border-radius: 12px;
  padding: 20px;
  height: 400px;
  display: flex;
  flex-direction: column;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.widget-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--professional-900);
}

[dir="rtl"] .widget-title {
  font-family: var(--font-arabic);
}

.view-all-button {
  font-size: 0.875rem;
  color: var(--saudi-navy);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.view-all-button:hover {
  color: var(--saudi-navy-light);
}

.consultations-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.consultation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--professional-200);
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.consultation-item:hover {
  border-color: var(--saudi-navy);
  background: rgba(26, 54, 93, 0.02);
}

.consultation-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.consultation-status-dot--completed {
  background: var(--compliance-success);
}

.consultation-status-dot--in-progress {
  background: var(--compliance-warning);
}

.consultation-status-dot--pending {
  background: var(--compliance-pending);
}

.consultation-info {
  flex: 1;
  min-width: 0;
}

.consultation-title {
  font-weight: 500;
  color: var(--professional-900);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[dir="rtl"] .consultation-title {
  text-align: right;
}

.consultation-meta {
  font-size: 0.75rem;
  color: var(--professional-500);
  display: flex;
  gap: 8px;
}

[dir="rtl"] .consultation-meta {
  font-size: 0.875rem;
  justify-content: flex-end;
}

.messages-count {
  font-size: 0.75rem;
  background: var(--professional-100);
  color: var(--professional-600);
  padding: 2px 6px;
  border-radius: 8px;
  min-width: 24px;
  text-align: center;
}
```

### 2. Compliance Overview Widget
Shows overall compliance status across different areas.

#### Specifications
```typescript
interface ComplianceOverviewProps {
  categories: ComplianceCategory[];
  overallScore: number;
  language?: 'ar' | 'en';
}

interface ComplianceCategory {
  id: string;
  name: string;
  score: number;
  status: 'compliant' | 'needs-attention' | 'non-compliant';
  itemsCount: number;
}
```

#### Visual Design
```css
.compliance-overview-widget {
  background: white;
  border: 1px solid var(--professional-200);
  border-radius: 12px;
  padding: 20px;
  height: 400px;
  display: flex;
  flex-direction: column;
}

.compliance-score-header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--professional-200);
}

.overall-score {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--saudi-navy);
  line-height: 1;
  margin-bottom: 4px;
}

.overall-score-label {
  font-size: 0.875rem;
  color: var(--professional-600);
}

[dir="rtl"] .overall-score-label {
  font-size: 1rem;
}

.compliance-categories {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compliance-category {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  transition: all 0.2s ease;
}

.compliance-category:hover {
  background: var(--professional-100);
}

.category-status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-status-indicator--compliant {
  background: var(--compliance-success);
}

.category-status-indicator--needs-attention {
  background: var(--compliance-warning);
}

.category-status-indicator--non-compliant {
  background: var(--compliance-error);
}

.category-info {
  flex: 1;
  min-width: 0;
}

.category-name {
  font-weight: 500;
  color: var(--professional-900);
  margin-bottom: 2px;
}

[dir="rtl"] .category-name {
  text-align: right;
}

.category-items-count {
  font-size: 0.75rem;
  color: var(--professional-500);
}

[dir="rtl"] .category-items-count {
  font-size: 0.875rem;
}

.category-score {
  font-weight: 600;
  color: var(--professional-700);
  font-size: 1.125rem;
}
```

### 3. Quick Actions Widget
Provides shortcuts to common HR tasks.

#### Specifications
```typescript
interface QuickActionsProps {
  actions: QuickAction[];
  language?: 'ar' | 'en';
}

interface QuickAction {
  id: string;
  title: string;
  description?: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}
```

#### Visual Design
```css
.quick-actions-widget {
  background: white;
  border: 1px solid var(--professional-200);
  border-radius: 12px;
  padding: 20px;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.quick-action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  border: 2px solid var(--professional-200);
  border-radius: 8px;
  background: white;
  color: var(--professional-700);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-action-button:hover {
  border-color: var(--saudi-navy);
  color: var(--saudi-navy);
  background: rgba(26, 54, 93, 0.02);
}

.quick-action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.quick-action-icon {
  width: 32px;
  height: 32px;
  color: currentColor;
}

.quick-action-title {
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
  line-height: 1.2;
}

[dir="rtl"] .quick-action-title {
  font-size: 1rem;
}

.quick-action-description {
  font-size: 0.75rem;
  color: var(--professional-500);
  text-align: center;
  line-height: 1.3;
  margin-top: 4px;
}

[dir="rtl"] .quick-action-description {
  font-size: 0.875rem;
}
```

---

## Implementation Guidelines

### Component Library Structure
```
/components
  /hr-platform
    /chat
      - ChatContainer.tsx
      - MessageBubble.tsx
      - ChatInput.tsx
    /document-upload
      - DocumentUploadArea.tsx
      - FileList.tsx
    /compliance
      - ComplianceBadge.tsx
      - ComplianceScoreCard.tsx
      - ComplianceTimeline.tsx
    /sources
      - SourceReferenceCard.tsx
      - SourcesSummary.tsx
    /dashboard
      - RecentConsultationsWidget.tsx
      - ComplianceOverviewWidget.tsx
      - QuickActionsWidget.tsx
```

### Accessibility Requirements
- All components must support keyboard navigation
- ARIA labels and descriptions for screen readers
- High contrast color combinations
- Proper heading hierarchy
- Alt text for all meaningful images and icons

### Responsive Design
- Mobile-first approach
- Touch-friendly interface elements (44px minimum)
- Collapsible navigation on smaller screens
- Optimized typography scaling
- Proper content reflow on different screen sizes

### Performance Considerations
- Lazy loading for large file lists
- Virtual scrolling for long chat histories
- Optimized images and icons
- Efficient re-rendering strategies
- Progressive loading for dashboard widgets

### Bilingual Support
- Dynamic font switching based on content language
- Proper RTL layout mirroring
- Text expansion considerations for Arabic
- Cultural appropriate color and spacing
- Localized date and number formatting

This comprehensive component specification provides the foundation for implementing a professional, culturally-appropriate HR Business Consultant RAG platform that serves Saudi Arabian businesses with excellence in both Arabic and English languages.