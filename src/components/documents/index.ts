// Document Management Components for HR RAG Platform

export { DocumentLibrary } from './DocumentLibrary';
export { DocumentCard } from './DocumentCard';
export { DocumentUploadZone } from './DocumentUploadZone';
export { CategoryManager } from './CategoryManager';
export { DocumentViewer } from './DocumentViewer';
export { DocumentFilters } from './DocumentFilters';
export { BulkOperations } from './BulkOperations';

// Types
export type {
  Document,
  DocumentCategory,
  DocumentSearchFilter,
  DocumentUpload,
  DocumentStatus,
  ProcessingMetadata,
  DocumentPermission,
  DocumentVersion,
  DocumentChunk,
  AllowedFileType,
} from '../../types/documents';