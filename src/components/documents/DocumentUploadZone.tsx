'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrganization } from '@/contexts/organization-context';
import { validateFile, formatFileSize, ALLOWED_FILE_TYPES } from '@/types/documents';
import type { DocumentCategory } from '@/types/documents';

interface DocumentUploadZoneProps {
  categories: DocumentCategory[];
  onUpload: (files: UploadFile[]) => Promise<void>;
  onClose?: () => void;
  className?: string;
  language?: 'ar' | 'en';
  maxFiles?: number;
}

interface UploadFile extends File {
  id: string;
  category_id?: string;
  tags: string[];
  language: 'ar' | 'en' | 'mixed';
  is_public: boolean;
  description?: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress?: number;
  error?: string;
}

export function DocumentUploadZone({
  categories,
  onUpload,
  onClose,
  className = '',
  language = 'ar',
  maxFiles = 10,
}: DocumentUploadZoneProps) {
  const { organization } = useOrganization();
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>('');
  const [defaultTags, setDefaultTags] = useState<string>('');
  const [defaultLanguage, setDefaultLanguage] = useState<'ar' | 'en' | 'mixed'>('ar');
  const [defaultPublic, setDefaultPublic] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const text = {
    ar: {
      title: 'رفع المستندات',
      dragDropText: 'اسحب الملفات هنا أو انقر للاختيار',
      selectFiles: 'اختيار الملفات',
      supportedFormats: 'الأنواع المدعومة:',
      maxSize: 'الحد الأقصى لحجم الملف:',
      category: 'التصنيف',
      selectCategory: 'اختر التصنيف',
      tags: 'العلامات',
      tagsPlaceholder: 'أدخل العلامات مفصولة بفواصل',
      language: 'اللغة',
      arabic: 'عربي',
      english: 'إنجليزي',
      mixed: 'مختلط',
      makePublic: 'جعل المستند عام (مرئي لجميع الأعضاء)',
      description: 'الوصف',
      descriptionPlaceholder: 'وصف اختياري للملف',
      upload: 'رفع الملفات',
      cancel: 'إلغاء',
      uploading: 'جاري الرفع...',
      completed: 'تم الرفع',
      error: 'خطأ',
      removeFile: 'إزالة الملف',
      filesSelected: 'ملف محدد',
      maxFilesError: `يمكن رفع ${maxFiles} ملفات كحد أقصى`,
      invalidFileType: 'نوع الملف غير مدعوم',
      fileTooLarge: 'حجم الملف كبير جداً',
    },
    en: {
      title: 'Upload Documents',
      dragDropText: 'Drag files here or click to select',
      selectFiles: 'Select Files',
      supportedFormats: 'Supported formats:',
      maxSize: 'Maximum file size:',
      category: 'Category',
      selectCategory: 'Select Category',
      tags: 'Tags',
      tagsPlaceholder: 'Enter tags separated by commas',
      language: 'Language',
      arabic: 'Arabic',
      english: 'English',
      mixed: 'Mixed',
      makePublic: 'Make document public (visible to all members)',
      description: 'Description',
      descriptionPlaceholder: 'Optional file description',
      upload: 'Upload Files',
      cancel: 'Cancel',
      uploading: 'Uploading...',
      completed: 'Completed',
      error: 'Error',
      removeFile: 'Remove File',
      filesSelected: 'files selected',
      maxFilesError: `Maximum ${maxFiles} files allowed`,
      invalidFileType: 'Unsupported file type',
      fileTooLarge: 'File too large',
    },
  };

  const t = text[language];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (uploadFiles.length + acceptedFiles.length > maxFiles) {
      alert(t.maxFilesError);
      return;
    }

    const newFiles: UploadFile[] = acceptedFiles.map((file) => {
      const validation = validateFile(file);
      return Object.assign(file, {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category_id: defaultCategory,
        tags: defaultTags.split(',').map(tag => tag.trim()).filter(Boolean),
        language: defaultLanguage,
        is_public: defaultPublic,
        status: validation.isValid ? 'pending' : 'error',
        error: validation.error,
      } as Partial<UploadFile>);
    });

    setUploadFiles(prev => [...prev, ...newFiles]);
  }, [uploadFiles.length, maxFiles, defaultCategory, defaultTags, defaultLanguage, defaultPublic, t.maxFilesError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: Object.keys(ALLOWED_FILE_TYPES).reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxFiles: maxFiles - uploadFiles.length,
    disabled: isUploading,
  });

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const updateFileMetadata = (
    fileId: string, 
    updates: Partial<Pick<UploadFile, 'category_id' | 'tags' | 'language' | 'is_public' | 'description'>>
  ) => {
    setUploadFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, ...updates } : f
    ));
  };

  const handleUpload = async () => {
    const validFiles = uploadFiles.filter(f => f.status !== 'error');
    if (validFiles.length === 0) return;

    setIsUploading(true);

    try {
      // Update status to uploading
      setUploadFiles(prev => prev.map(f => 
        f.status === 'pending' ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      await onUpload(validFiles);

      // Update status to completed
      setUploadFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'completed', progress: 100 } : f
      ));

      // Clear files after successful upload
      setTimeout(() => {
        setUploadFiles([]);
        onClose?.();
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadFiles(prev => prev.map(f => 
        f.status === 'uploading' 
          ? { 
              ...f, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed' 
            } 
          : f
      ));
    } finally {
      setIsUploading(false);
    }
  };

  const formatSupportedTypes = () => {
    return Object.values(ALLOWED_FILE_TYPES)
      .map(config => config.label)
      .filter((label, index, arr) => arr.indexOf(label) === index)
      .join(', ');
  };

  const getMaxSize = () => {
    const maxSize = Math.max(...Object.values(ALLOWED_FILE_TYPES).map(config => config.maxSize));
    return formatFileSize(maxSize, language);
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-saudi-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
        return (
          <div className="h-4 w-4 border-2 border-saudi-navy-600 border-t-transparent rounded-full animate-spin" />
        );
      default:
        return <FileText className="h-4 w-4 text-saudi-navy-600" />;
    }
  };

  if (!organization) return null;

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-saudi-navy-900 arabic-heading">
          {t.title}
        </h3>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-saudi-green-500 bg-saudi-green-50' 
            : 'border-gray-300 hover:border-saudi-navy-400'
          }
          ${isUploading ? 'cursor-not-allowed opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 text-saudi-navy-400 mx-auto mb-4" />
        <p className="text-lg text-saudi-navy-700 mb-2 arabic-text">
          {t.dragDropText}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mb-4"
          disabled={isUploading}
        >
          {t.selectFiles}
        </Button>
        <div className="text-sm text-gray-500 space-y-1">
          <p>{t.supportedFormats} {formatSupportedTypes()}</p>
          <p>{t.maxSize} {getMaxSize()}</p>
        </div>
      </div>

      {/* Default Settings */}
      {uploadFiles.length === 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
              {t.category}
            </label>
            <select
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-saudi-navy-500 focus:border-saudi-navy-500"
            >
              <option value="">{t.selectCategory}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
              {t.language}
            </label>
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value as 'ar' | 'en' | 'mixed')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-saudi-navy-500 focus:border-saudi-navy-500"
            >
              <option value="ar">{t.arabic}</option>
              <option value="en">{t.english}</option>
              <option value="mixed">{t.mixed}</option>
            </select>
          </div>

          {/* Tags */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
              {t.tags}
            </label>
            <Input
              ref={tagInputRef}
              value={defaultTags}
              onChange={(e) => setDefaultTags(e.target.value)}
              placeholder={t.tagsPlaceholder}
              className="arabic-text"
            />
          </div>

          {/* Public checkbox */}
          <div className="md:col-span-2">
            <label className="flex items-center space-x-2 space-x-reverse">
              <input
                type="checkbox"
                checked={defaultPublic}
                onChange={(e) => setDefaultPublic(e.target.checked)}
                className="w-4 h-4 text-saudi-navy-600 border-gray-300 rounded focus:ring-saudi-navy-500"
              />
              <span className="text-sm text-saudi-navy-700 arabic-text">
                {t.makePublic}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* File List */}
      {uploadFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-medium text-saudi-navy-900 mb-4 arabic-heading">
            {uploadFiles.length} {t.filesSelected}
          </h4>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {uploadFiles.map((file) => (
              <div
                key={file.id}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 space-x-reverse flex-1">
                    {getStatusIcon(file.status)}
                    <div className="flex-1">
                      <p className="font-medium text-saudi-navy-900 arabic-text">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size, language)}
                      </p>
                      {file.error && (
                        <p className="text-sm text-red-500 mt-1">{file.error}</p>
                      )}
                      {file.status === 'uploading' && file.progress !== undefined && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-saudi-navy-600 h-2 rounded-full transition-all"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    disabled={file.status === 'uploading'}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                    title={t.removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* File-specific settings */}
                {file.status !== 'error' && file.status !== 'completed' && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Category */}
                    <div>
                      <select
                        value={file.category_id || ''}
                        onChange={(e) => updateFileMetadata(file.id, { 
                          category_id: e.target.value || undefined 
                        })}
                        className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-saudi-navy-500 focus:border-saudi-navy-500"
                        disabled={file.status === 'uploading'}
                      >
                        <option value="">{t.selectCategory}</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Language */}
                    <div>
                      <select
                        value={file.language}
                        onChange={(e) => updateFileMetadata(file.id, { 
                          language: e.target.value as 'ar' | 'en' | 'mixed'
                        })}
                        className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-saudi-navy-500 focus:border-saudi-navy-500"
                        disabled={file.status === 'uploading'}
                      >
                        <option value="ar">{t.arabic}</option>
                        <option value="en">{t.english}</option>
                        <option value="mixed">{t.mixed}</option>
                      </select>
                    </div>

                    {/* Public */}
                    <div className="flex items-center">
                      <label className="flex items-center space-x-2 space-x-reverse">
                        <input
                          type="checkbox"
                          checked={file.is_public}
                          onChange={(e) => updateFileMetadata(file.id, { 
                            is_public: e.target.checked 
                          })}
                          className="w-4 h-4 text-saudi-navy-600 border-gray-300 rounded focus:ring-saudi-navy-500"
                          disabled={file.status === 'uploading'}
                        />
                        <span className="text-sm text-saudi-navy-700">
                          عام / Public
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Upload Actions */}
          <div className="mt-6 flex justify-end space-x-3 space-x-reverse">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || uploadFiles.every(f => f.status === 'error' || f.status === 'completed')}
              className="bg-saudi-navy-600 hover:bg-saudi-navy-700"
            >
              {isUploading ? t.uploading : t.upload}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}