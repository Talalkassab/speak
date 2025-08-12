// Document Management Utilities for HR RAG Platform
import { createSupabaseBrowserClient } from '@/libs/supabase/supabase-browser-client';
import type { 
  Document, 
  DocumentCategory, 
  DocumentSearchFilter, 
  DocumentUpload,
  AllowedFileType,
  ALLOWED_FILE_TYPES 
} from '@/types/documents';

// File handling utilities
export const uploadFileToStorage = async (
  file: File,
  organizationId: string,
  fileName?: string
): Promise<{ path: string; url: string }> => {
  const supabase = createSupabaseBrowserClient();
  
  // Generate unique file path
  const timestamp = Date.now();
  const fileExtension = file.name.split('.').pop();
  const sanitizedFileName = fileName || file.name.replace(/[^a-zA-Z0-9\u0600-\u06FF._-]/g, '_');
  const filePath = `${organizationId}/documents/${timestamp}_${sanitizedFileName}`;
  
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('hr-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) {
    throw new Error(`فشل في رفع الملف: ${error.message} / Upload failed: ${error.message}`);
  }
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('hr-documents')
    .getPublicUrl(data.path);
  
  return {
    path: data.path,
    url: publicUrl,
  };
};

export const deleteFileFromStorage = async (filePath: string): Promise<void> => {
  const supabase = createSupabaseBrowserClient();
  
  const { error } = await supabase.storage
    .from('hr-documents')
    .remove([filePath]);
  
  if (error) {
    throw new Error(`فشل في حذف الملف: ${error.message} / Delete failed: ${error.message}`);
  }
};

// Document database operations
export const createDocument = async (
  organizationId: string,
  documentData: {
    title: string;
    description?: string;
    category_id?: string;
    filename: string;
    file_size: number;
    file_type: string;
    mime_type: string;
    content_language: 'ar' | 'en' | 'mixed';
    storage_path: string;
    upload_url: string;
    tags: string[];
    is_public: boolean;
  }
): Promise<Document> => {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('documents')
    .insert({
      organization_id: organizationId,
      ...documentData,
      status: 'processing',
      processing_metadata: {
        progress: 0,
        text_extraction_complete: false,
        embeddings_generated: false,
      },
      version: 1,
    })
    .select(`
      *,
      category:document_categories(*),
      uploader:auth.users(id, email)
    `)
    .single();
  
  if (error) {
    throw new Error(`فشل في إنشاء المستند: ${error.message} / Document creation failed: ${error.message}`);
  }
  
  return data;
};

export const updateDocumentStatus = async (
  documentId: string,
  status: Document['status'],
  metadata?: Partial<Document['processing_metadata']>
): Promise<void> => {
  const supabase = createSupabaseBrowserClient();
  
  const updateData: any = { status };
  if (metadata) {
    updateData.processing_metadata = metadata;
  }
  
  const { error } = await supabase
    .from('documents')
    .update(updateData)
    .eq('id', documentId);
  
  if (error) {
    throw new Error(`فشل في تحديث حالة المستند: ${error.message} / Status update failed: ${error.message}`);
  }
};

export const getDocuments = async (
  organizationId: string,
  filters: DocumentSearchFilter = {}
): Promise<{ documents: Document[]; totalCount: number }> => {
  const supabase = createSupabaseBrowserClient();
  
  let query = supabase
    .from('documents')
    .select(`
      *,
      category:document_categories(*),
      uploader:auth.users(id, email)
    `, { count: 'exact' })
    .eq('organization_id', organizationId);
  
  // Apply filters
  if (filters.search_query) {
    query = query.or(`title.ilike.%${filters.search_query}%,filename.ilike.%${filters.search_query}%,tags.cs.{${filters.search_query}}`);
  }
  
  if (filters.category_id) {
    query = query.eq('category_id', filters.category_id);
  }
  
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters.language) {
    query = query.eq('content_language', filters.language);
  }
  
  if (filters.uploaded_by) {
    query = query.eq('uploaded_by', filters.uploaded_by);
  }
  
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  
  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }
  
  if (filters.file_types && filters.file_types.length > 0) {
    query = query.in('file_type', filters.file_types);
  }
  
  if (filters.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }
  
  // Apply sorting
  if (filters.sort_by && filters.sort_order) {
    query = query.order(filters.sort_by, { ascending: filters.sort_order === 'asc' });
  }
  
  // Apply pagination
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`فشل في جلب المستندات: ${error.message} / Failed to fetch documents: ${error.message}`);
  }
  
  return {
    documents: data || [],
    totalCount: count || 0,
  };
};

export const getDocumentById = async (
  documentId: string,
  organizationId: string
): Promise<Document | null> => {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('documents')
    .select(`
      *,
      category:document_categories(*),
      uploader:auth.users(id, email)
    `)
    .eq('id', documentId)
    .eq('organization_id', organizationId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`فشل في جلب المستند: ${error.message} / Failed to fetch document: ${error.message}`);
  }
  
  return data;
};

export const deleteDocument = async (
  documentId: string,
  organizationId: string
): Promise<void> => {
  const supabase = createSupabaseBrowserClient();
  
  // First get the document to get the storage path
  const document = await getDocumentById(documentId, organizationId);
  if (!document) {
    throw new Error('المستند غير موجود / Document not found');
  }
  
  // Delete from storage if path exists
  if (document.storage_path) {
    try {
      await deleteFileFromStorage(document.storage_path);
    } catch (error) {
      console.error('Error deleting file from storage:', error);
      // Continue with database deletion even if storage deletion fails
    }
  }
  
  // Delete from database
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', organizationId);
  
  if (error) {
    throw new Error(`فشل في حذف المستند: ${error.message} / Failed to delete document: ${error.message}`);
  }
};

export const updateDocument = async (
  documentId: string,
  organizationId: string,
  updates: Partial<Pick<Document, 'title' | 'description' | 'category_id' | 'tags' | 'is_public'>>
): Promise<Document> => {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
    .eq('organization_id', organizationId)
    .select(`
      *,
      category:document_categories(*),
      uploader:auth.users(id, email)
    `)
    .single();
  
  if (error) {
    throw new Error(`فشل في تحديث المستند: ${error.message} / Failed to update document: ${error.message}`);
  }
  
  return data;
};

// Document category operations
export const getDocumentCategories = async (organizationId: string): Promise<DocumentCategory[]> => {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('document_categories')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');
  
  if (error) {
    throw new Error(`فشل في جلب التصنيفات: ${error.message} / Failed to fetch categories: ${error.message}`);
  }
  
  return data || [];
};

export const createDocumentCategory = async (
  organizationId: string,
  categoryData: Pick<DocumentCategory, 'name' | 'description' | 'color'>
): Promise<DocumentCategory> => {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('document_categories')
    .insert({
      organization_id: organizationId,
      ...categoryData,
      is_system: false,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`فشل في إنشاء التصنيف: ${error.message} / Failed to create category: ${error.message}`);
  }
  
  return data;
};

export const updateDocumentCategory = async (
  categoryId: string,
  organizationId: string,
  updates: Partial<Pick<DocumentCategory, 'name' | 'description' | 'color'>>
): Promise<DocumentCategory> => {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('document_categories')
    .update(updates)
    .eq('id', categoryId)
    .eq('organization_id', organizationId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`فشل في تحديث التصنيف: ${error.message} / Failed to update category: ${error.message}`);
  }
  
  return data;
};

export const deleteDocumentCategory = async (
  categoryId: string,
  organizationId: string
): Promise<void> => {
  const supabase = createSupabaseBrowserClient();
  
  // Check if category has documents
  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('organization_id', organizationId);
  
  if (count && count > 0) {
    throw new Error('لا يمكن حذف التصنيف لأنه يحتوي على مستندات / Cannot delete category with existing documents');
  }
  
  const { error } = await supabase
    .from('document_categories')
    .delete()
    .eq('id', categoryId)
    .eq('organization_id', organizationId)
    .eq('is_system', false); // Only allow deletion of non-system categories
  
  if (error) {
    throw new Error(`فشل في حذف التصنيف: ${error.message} / Failed to delete category: ${error.message}`);
  }
};

// File validation utilities
export const validateFileSize = (file: File): { isValid: boolean; error?: string } => {
  const fileType = file.type as AllowedFileType;
  const config = ALLOWED_FILE_TYPES[fileType];
  
  if (!config) {
    return {
      isValid: false,
      error: 'نوع الملف غير مدعوم / Unsupported file type',
    };
  }
  
  if (file.size > config.maxSize) {
    return {
      isValid: false,
      error: `حجم الملف كبير جداً. الحد الأقصى ${formatBytes(config.maxSize)} / File too large. Maximum ${formatBytes(config.maxSize)}`,
    };
  }
  
  return { isValid: true };
};

export const validateFileType = (file: File): { isValid: boolean; error?: string } => {
  const fileType = file.type as AllowedFileType;
  
  if (!ALLOWED_FILE_TYPES[fileType]) {
    return {
      isValid: false,
      error: 'نوع الملف غير مدعوم / Unsupported file type',
    };
  }
  
  return { isValid: true };
};

export const validateFileName = (fileName: string): { isValid: boolean; error?: string } => {
  const invalidChars = /[<>:"/\\|?*]/;
  
  if (invalidChars.test(fileName)) {
    return {
      isValid: false,
      error: 'اسم الملف يحتوي على رموز غير مسموحة / Filename contains invalid characters',
    };
  }
  
  if (fileName.length > 255) {
    return {
      isValid: false,
      error: 'اسم الملف طويل جداً / Filename too long',
    };
  }
  
  return { isValid: true };
};

// Helper function for file size formatting
const formatBytes = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

// Search utilities
export const buildSearchQuery = (searchTerm: string, language: 'ar' | 'en' = 'ar'): string => {
  if (!searchTerm.trim()) return '';
  
  const terms = searchTerm.trim().split(/\s+/);
  
  // For Arabic, search in both Arabic and transliterated forms
  if (language === 'ar') {
    return terms.map(term => `${term}*`).join(' & ');
  }
  
  return terms.map(term => `${term}:*`).join(' & ');
};

export const highlightSearchTerms = (text: string, searchTerm: string): string => {
  if (!searchTerm.trim()) return text;
  
  const terms = searchTerm.trim().split(/\s+/);
  let highlightedText = text;
  
  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  });
  
  return highlightedText;
};

// Document processing utilities
export const extractTextFromFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = reject;
      reader.readAsText(file);
    } else {
      // For other file types, we'll need server-side processing
      // This is a placeholder - actual implementation would use server-side text extraction
      resolve('');
    }
  });
};

// Bulk operations
export const processBulkUpload = async (
  files: File[],
  organizationId: string,
  commonMetadata: {
    category_id?: string;
    tags: string[];
    language: 'ar' | 'en' | 'mixed';
    is_public: boolean;
  }
): Promise<{
  successful: Document[];
  failed: { file: File; error: string }[];
}> => {
  const results = {
    successful: [] as Document[],
    failed: [] as { file: File; error: string }[],
  };
  
  for (const file of files) {
    try {
      // Validate file
      const validation = validateFileType(file);
      if (!validation.isValid) {
        results.failed.push({ file, error: validation.error || 'Invalid file' });
        continue;
      }
      
      const sizeValidation = validateFileSize(file);
      if (!sizeValidation.isValid) {
        results.failed.push({ file, error: sizeValidation.error || 'File too large' });
        continue;
      }
      
      // Upload file
      const { path, url } = await uploadFileToStorage(file, organizationId);
      
      // Create document record
      const document = await createDocument(organizationId, {
        title: file.name.split('.')[0],
        filename: file.name,
        file_size: file.size,
        file_type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
        mime_type: file.type,
        content_language: commonMetadata.language,
        storage_path: path,
        upload_url: url,
        tags: commonMetadata.tags,
        is_public: commonMetadata.is_public,
        category_id: commonMetadata.category_id,
      });
      
      results.successful.push(document);
    } catch (error) {
      results.failed.push({ 
        file, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  return results;
};

export const generateDocumentPreview = (document: Document): string => {
  const { title, description, filename, file_size, tags, created_at } = document;
  
  return `${title}\n${description || ''}\nFile: ${filename}\nSize: ${formatBytes(file_size)}\nTags: ${tags.join(', ')}\nCreated: ${new Date(created_at).toLocaleDateString()}`;
};