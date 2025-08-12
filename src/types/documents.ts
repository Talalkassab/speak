// Document Management Types for HR RAG Platform

export interface DocumentCategory {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  color: string;
  is_system: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  organization_id: string;
  category_id?: string;
  title: string;
  description?: string;
  filename: string;
  file_size: number;
  file_type: string;
  mime_type: string;
  content?: string;
  content_language: 'ar' | 'en' | 'mixed';
  upload_url?: string;
  storage_path?: string;
  version: number;
  parent_document_id?: string;
  status: DocumentStatus;
  processing_metadata: ProcessingMetadata;
  tags: string[];
  is_public: boolean;
  uploaded_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  
  // Joined relations
  category?: DocumentCategory;
  uploader?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export type DocumentStatus = 'processing' | 'completed' | 'failed' | 'archived';

export interface ProcessingMetadata {
  error?: string;
  progress?: number;
  chunks_created?: number;
  embeddings_generated?: boolean;
  text_extraction_complete?: boolean;
  ocr_applied?: boolean;
  language_detected?: string;
  processing_time_ms?: number;
}

export interface DocumentUpload {
  files: FileList | File[];
  category_id?: string;
  tags: string[];
  language: 'ar' | 'en' | 'mixed';
  is_public?: boolean;
  description?: string;
}

export interface DocumentSearchFilter {
  search_query?: string;
  category_id?: string;
  tags?: string[];
  status?: DocumentStatus;
  language?: 'ar' | 'en' | 'mixed';
  uploaded_by?: string;
  date_from?: string;
  date_to?: string;
  file_types?: string[];
  sort_by?: 'created_at' | 'filename' | 'file_size' | 'updated_at';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface DocumentPermission {
  id: string;
  document_id: string;
  user_id?: string;
  role?: string;
  permission: 'read' | 'write' | 'admin';
  granted_by: string;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  filename: string;
  file_size: number;
  changes_summary?: string;
  uploaded_by: string;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  organization_id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  chunk_type: 'title' | 'paragraph' | 'table' | 'list';
  page_number?: number;
  section_title?: string;
  embedding?: number[];
  embedding_model: string;
  language: 'ar' | 'en';
  created_at: string;
}

// Pre-defined HR categories for Saudi organizations
export const DEFAULT_HR_CATEGORIES = {
  ar: [
    {
      name: 'سياسات الموارد البشرية',
      description: 'سياسات وإجراءات الموارد البشرية العامة',
      color: '#1a365d', // saudi-navy-900
    },
    {
      name: 'عقود العمل',
      description: 'عقود ومستندات التوظيف والعمل',
      color: '#0f7b0f', // saudi-green-900
    },
    {
      name: 'الرواتب والمزايا',
      description: 'مستندات الرواتب والتعويضات والمزايا',
      color: '#744210', // saudi-gold-900
    },
    {
      name: 'التدريب والتطوير',
      description: 'مواد التدريب والتطوير المهني',
      color: '#134e4a', // teal-900
    },
    {
      name: 'الامتثال والقوانين',
      description: 'مستندات الامتثال والقوانين السعودية',
      color: '#7c2d12', // orange-900
    },
    {
      name: 'الإجازات والغياب',
      description: 'سياسات الإجازات وطلبات الغياب',
      color: '#581c87', // purple-900
    },
    {
      name: 'السلامة والصحة المهنية',
      description: 'إرشادات السلامة والصحة في مكان العمل',
      color: '#991b1b', // red-900
    },
    {
      name: 'النماذج والمستندات',
      description: 'النماذج الرسمية والمستندات الإدارية',
      color: '#365314', // lime-900
    },
    {
      name: 'التقارير السنوية',
      description: 'التقارير السنوية وتقييمات الأداء',
      color: '#1e3a8a', // blue-900
    },
    {
      name: 'أخرى',
      description: 'مستندات أخرى غير مصنفة',
      color: '#6b7280', // gray-500
    },
  ],
  en: [
    {
      name: 'HR Policies',
      description: 'General human resources policies and procedures',
      color: '#1a365d',
    },
    {
      name: 'Employment Contracts',
      description: 'Employment contracts and hiring documents',
      color: '#0f7b0f',
    },
    {
      name: 'Compensation & Benefits',
      description: 'Salary, compensation and benefits documentation',
      color: '#744210',
    },
    {
      name: 'Training & Development',
      description: 'Training materials and professional development',
      color: '#134e4a',
    },
    {
      name: 'Compliance & Legal',
      description: 'Compliance documents and Saudi labor law',
      color: '#7c2d12',
    },
    {
      name: 'Leave & Absence',
      description: 'Leave policies and absence requests',
      color: '#581c87',
    },
    {
      name: 'Health & Safety',
      description: 'Workplace health and safety guidelines',
      color: '#991b1b',
    },
    {
      name: 'Forms & Templates',
      description: 'Official forms and administrative templates',
      color: '#365314',
    },
    {
      name: 'Annual Reports',
      description: 'Annual reports and performance evaluations',
      color: '#1e3a8a',
    },
    {
      name: 'Other',
      description: 'Other uncategorized documents',
      color: '#6b7280',
    },
  ],
};

// File type configurations
export const ALLOWED_FILE_TYPES = {
  'application/pdf': { icon: '📄', label: 'PDF', maxSize: 50 * 1024 * 1024 }, // 50MB
  'application/msword': { icon: '📝', label: 'Word', maxSize: 25 * 1024 * 1024 }, // 25MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { 
    icon: '📝', 
    label: 'Word', 
    maxSize: 25 * 1024 * 1024 
  },
  'text/plain': { icon: '📄', label: 'Text', maxSize: 5 * 1024 * 1024 }, // 5MB
  'application/vnd.ms-excel': { icon: '📊', label: 'Excel', maxSize: 25 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { 
    icon: '📊', 
    label: 'Excel', 
    maxSize: 25 * 1024 * 1024 
  },
  'application/vnd.ms-powerpoint': { icon: '📊', label: 'PowerPoint', maxSize: 50 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { 
    icon: '📊', 
    label: 'PowerPoint', 
    maxSize: 50 * 1024 * 1024 
  },
} as const;

export type AllowedFileType = keyof typeof ALLOWED_FILE_TYPES;

// Language detection helpers
export const isArabicText = (text: string): boolean => {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicRegex.test(text);
};

export const detectTextLanguage = (text: string): 'ar' | 'en' | 'mixed' => {
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  
  if (totalChars === 0) return 'en';
  
  const arabicRatio = arabicChars / totalChars;
  
  if (arabicRatio > 0.7) return 'ar';
  if (arabicRatio > 0.3) return 'mixed';
  return 'en';
};

// Document status helpers
export const getStatusColor = (status: DocumentStatus): string => {
  switch (status) {
    case 'completed':
      return '#10b981'; // green-500
    case 'processing':
      return '#f59e0b'; // amber-500
    case 'failed':
      return '#ef4444'; // red-500
    case 'archived':
      return '#6b7280'; // gray-500
    default:
      return '#6b7280';
  }
};

export const getStatusLabel = (status: DocumentStatus, language: 'ar' | 'en' = 'ar'): string => {
  const labels = {
    ar: {
      completed: 'مكتمل',
      processing: 'قيد المعالجة',
      failed: 'فشل',
      archived: 'مؤرشف',
    },
    en: {
      completed: 'Completed',
      processing: 'Processing',
      failed: 'Failed',
      archived: 'Archived',
    },
  };
  
  return labels[language][status];
};

// File size formatting
export const formatFileSize = (bytes: number, language: 'ar' | 'en' = 'ar'): string => {
  const sizes = language === 'ar' 
    ? ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت']
    : ['B', 'KB', 'MB', 'GB'];
  
  if (bytes === 0) return `0 ${sizes[0]}`;
  
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  
  return `${size} ${sizes[i]}`;
};

// Document metadata extraction helpers
export const extractDocumentMetadata = (file: File) => {
  return {
    filename: file.name,
    file_size: file.size,
    file_type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
    mime_type: file.type,
    content_language: detectTextLanguage(file.name) as 'ar' | 'en' | 'mixed',
    upload_date: new Date().toISOString(),
  };
};

// Validation helpers
export const validateFile = (file: File): { isValid: boolean; error?: string } => {
  const fileType = file.type as AllowedFileType;
  
  if (!ALLOWED_FILE_TYPES[fileType]) {
    return {
      isValid: false,
      error: 'نوع الملف غير مدعوم / Unsupported file type',
    };
  }
  
  const maxSize = ALLOWED_FILE_TYPES[fileType].maxSize;
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `حجم الملف كبير جداً. الحد الأقصى ${formatFileSize(maxSize)} / File too large. Maximum ${formatFileSize(maxSize, 'en')}`,
    };
  }
  
  return { isValid: true };
};

// Search and filter utilities
export const createSearchFilter = (
  query: string,
  filters: Partial<DocumentSearchFilter>
): DocumentSearchFilter => {
  return {
    search_query: query.trim() || undefined,
    ...filters,
    sort_by: filters.sort_by || 'updated_at',
    sort_order: filters.sort_order || 'desc',
    limit: filters.limit || 20,
    offset: filters.offset || 0,
  };
};