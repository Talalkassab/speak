'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DocumentLibrary,
  DocumentUploadZone,
  CategoryManager,
  DocumentViewer,
  DocumentFilters,
  BulkOperations,
} from '@/components/documents';
import { useOrganization } from '@/contexts/organization-context';
import { getDocumentCategories } from '@/utils/document-utils';
import type { Document, DocumentCategory } from '@/types/documents';

export default function DocumentTestPage() {
  const { organization } = useOrganization();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);
  const [viewedDocument, setViewedDocument] = useState<Document | null>(null);
  const [activeComponent, setActiveComponent] = useState('library');

  useEffect(() => {
    if (organization) {
      getDocumentCategories(organization.id)
        .then(setCategories)
        .catch(console.error);
    }
  }, [organization]);

  const components = {
    library: {
      name: 'Document Library',
      component: (
        <DocumentLibrary
          language="ar"
          onDocumentSelect={(doc) => console.log('Selected:', doc)}
          onDocumentView={setViewedDocument}
        />
      ),
    },
    upload: {
      name: 'Upload Zone',
      component: (
        <DocumentUploadZone
          categories={categories}
          onUpload={async (files) => {
            console.log('Uploading:', files.map(f => f.name));
            // Mock upload
            await new Promise(resolve => setTimeout(resolve, 2000));
          }}
          language="ar"
        />
      ),
    },
    categories: {
      name: 'Category Manager',
      component: (
        <CategoryManager
          language="ar"
          onCategorySelect={(cat) => console.log('Selected category:', cat)}
        />
      ),
    },
    filters: {
      name: 'Document Filters',
      component: (
        <DocumentFilters
          onFiltersChange={(filters) => console.log('Filters changed:', filters)}
          language="ar"
        />
      ),
    },
    bulk: {
      name: 'Bulk Operations',
      component: (
        <BulkOperations
          selectedDocuments={selectedDocuments}
          categories={categories}
          onSelectionChange={setSelectedDocuments}
          onOperationComplete={() => console.log('Operation complete')}
          language="ar"
        />
      ),
    },
  };

  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">No Organization Selected</h2>
          <p className="text-gray-600">Please select an organization to test the document management system.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-saudi-navy-900 arabic-heading mb-2">
            اختبار نظام إدارة المستندات
          </h1>
          <p className="text-gray-600 arabic-text">
            اختبار جميع مكونات نظام إدارة المستندات لمنصة الموارد البشرية
          </p>
          
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(components).map(([key, { name }]) => (
              <Button
                key={key}
                variant={activeComponent === key ? 'default' : 'outline'}
                onClick={() => setActiveComponent(key)}
                className={activeComponent === key ? 'bg-saudi-navy-600' : ''}
              >
                {name}
              </Button>
            ))}
          </div>
          
          <div className="mt-4 flex items-center space-x-4 space-x-reverse">
            <Badge className="bg-saudi-green-600">
              Organization: {organization.name}
            </Badge>
            <Badge className="bg-purple-600">
              Categories: {categories.length}
            </Badge>
            <Badge className="bg-blue-600">
              Selected: {selectedDocuments.length}
            </Badge>
          </div>
        </div>

        {/* Component Display */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 arabic-heading">
            {components[activeComponent as keyof typeof components].name}
          </h2>
          
          {components[activeComponent as keyof typeof components].component}
        </div>

        {/* Mock Data Controls */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 arabic-heading">أدوات الاختبار</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => {
                const mockDoc: Document = {
                  id: Date.now().toString(),
                  organization_id: organization.id,
                  title: 'مستند تجريبي',
                  description: 'هذا مستند تجريبي للاختبار',
                  filename: 'test-document.pdf',
                  file_size: 1024000,
                  file_type: 'pdf',
                  mime_type: 'application/pdf',
                  content_language: 'ar',
                  status: 'completed',
                  processing_metadata: {
                    progress: 100,
                    text_extraction_complete: true,
                    embeddings_generated: true,
                  },
                  tags: ['اختبار', 'تجربة'],
                  is_public: false,
                  uploaded_by: 'user-123',
                  version: 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  uploader: {
                    id: 'user-123',
                    email: 'test@example.com'
                  }
                };
                setSelectedDocuments(prev => [...prev, mockDoc]);
              }}
            >
              إضافة مستند وهمي
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setSelectedDocuments([])}
            >
              مسح التحديد
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                console.log('Current State:', {
                  organization: organization.name,
                  categories: categories.length,
                  selectedDocuments: selectedDocuments.length,
                  activeComponent,
                });
              }}
            >
              طباعة الحالة
            </Button>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {viewedDocument && (
        <DocumentViewer
          document={viewedDocument}
          isOpen={!!viewedDocument}
          onClose={() => setViewedDocument(null)}
          language="ar"
        />
      )}
    </div>
  );
}