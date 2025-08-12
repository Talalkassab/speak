'use client';

import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Plus, 
  Palette,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useOrganization, usePermissions } from '@/contexts/organization-context';
import { 
  getDocumentCategories,
  createDocumentCategory,
  updateDocumentCategory,
  deleteDocumentCategory
} from '@/utils/document-utils';
import { DEFAULT_HR_CATEGORIES } from '@/types/documents';
import type { DocumentCategory } from '@/types/documents';

interface CategoryManagerProps {
  language?: 'ar' | 'en';
  onCategorySelect?: (category: DocumentCategory) => void;
  onClose?: () => void;
  className?: string;
}

interface CategoryForm {
  name: string;
  description: string;
  color: string;
}

const COLOR_PALETTE = [
  '#1a365d', // saudi-navy-900
  '#0f7b0f', // saudi-green-900  
  '#744210', // saudi-gold-900
  '#134e4a', // teal-900
  '#7c2d12', // orange-900
  '#581c87', // purple-900
  '#991b1b', // red-900
  '#365314', // lime-900
  '#1e3a8a', // blue-900
  '#6b7280', // gray-500
  '#ef4444', // red-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
];

export function CategoryManager({
  language = 'ar',
  onCategorySelect,
  onClose,
  className = '',
}: CategoryManagerProps) {
  const { organization } = useOrganization();
  const { canManageDocuments } = usePermissions();
  
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CategoryForm>({
    name: '',
    description: '',
    color: COLOR_PALETTE[0],
  });

  const text = {
    ar: {
      title: 'إدارة التصنيفات',
      createCategory: 'إنشاء تصنيف جديد',
      editCategory: 'تحرير التصنيف',
      categoryName: 'اسم التصنيف',
      categoryDescription: 'وصف التصنيف',
      categoryColor: 'لون التصنيف',
      save: 'حفظ',
      cancel: 'إلغاء',
      edit: 'تحرير',
      delete: 'حذف',
      confirmDelete: 'هل أنت متأكد من حذف هذا التصنيف؟',
      nameRequired: 'اسم التصنيف مطلوب',
      nameExists: 'اسم التصنيف موجود بالفعل',
      createSuccess: 'تم إنشاء التصنيف بنجاح',
      updateSuccess: 'تم تحديث التصنيف بنجاح',
      deleteSuccess: 'تم حذف التصنيف بنجاح',
      loadingError: 'خطأ في تحميل التصنيفات',
      systemCategory: 'تصنيف نظام',
      customCategory: 'تصنيف مخصص',
      noCategories: 'لا توجد تصنيفات',
      addDefaultCategories: 'إضافة التصنيفات الافتراضية',
      defaultCategoriesAdded: 'تم إضافة التصنيفات الافتراضية',
      close: 'إغلاق',
      namePlaceholder: 'أدخل اسم التصنيف',
      descriptionPlaceholder: 'أدخل وصف التصنيف (اختياري)',
    },
    en: {
      title: 'Category Management',
      createCategory: 'Create New Category',
      editCategory: 'Edit Category',
      categoryName: 'Category Name',
      categoryDescription: 'Category Description',
      categoryColor: 'Category Color',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      confirmDelete: 'Are you sure you want to delete this category?',
      nameRequired: 'Category name is required',
      nameExists: 'Category name already exists',
      createSuccess: 'Category created successfully',
      updateSuccess: 'Category updated successfully',
      deleteSuccess: 'Category deleted successfully',
      loadingError: 'Error loading categories',
      systemCategory: 'System Category',
      customCategory: 'Custom Category',
      noCategories: 'No categories found',
      addDefaultCategories: 'Add Default Categories',
      defaultCategoriesAdded: 'Default categories added',
      close: 'Close',
      namePlaceholder: 'Enter category name',
      descriptionPlaceholder: 'Enter category description (optional)',
    },
  };

  const t = text[language];

  // Load categories
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    if (!organization) return;
    
    setIsLoading(true);
    try {
      const fetchedCategories = await getDocumentCategories(organization.id);
      setCategories(fetchedCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError(err instanceof Error ? err.message : t.loadingError);
    } finally {
      setIsLoading(false);
    }
  };

  // Form validation
  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return t.nameRequired;
    }
    
    const existingCategory = categories.find(
      cat => cat.name.toLowerCase() === formData.name.toLowerCase() && 
             cat.id !== editingId
    );
    
    if (existingCategory) {
      return t.nameExists;
    }
    
    return null;
  };

  // Handlers
  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      color: COLOR_PALETTE[0],
    });
  };

  const handleStartEdit = (category: DocumentCategory) => {
    setIsCreating(false);
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
    });
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      color: COLOR_PALETTE[0],
    });
  };

  const handleSaveCategory = async () => {
    if (!organization || !canManageDocuments()) return;
    
    const validationError = validateForm();
    if (validationError) {
      alert(validationError);
      return;
    }
    
    try {
      if (isCreating) {
        await createDocumentCategory(organization.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color,
        });
        alert(t.createSuccess);
      } else if (editingId) {
        await updateDocumentCategory(editingId, organization.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color,
        });
        alert(t.updateSuccess);
      }
      
      handleCancelForm();
      await loadCategories();
    } catch (error) {
      console.error('Save category failed:', error);
      alert(error instanceof Error ? error.message : 'Save failed');
    }
  };

  const handleDeleteCategory = async (category: DocumentCategory) => {
    if (!organization || !canManageDocuments() || category.is_system) return;
    
    if (!confirm(t.confirmDelete)) return;
    
    try {
      await deleteDocumentCategory(category.id, organization.id);
      alert(t.deleteSuccess);
      await loadCategories();
    } catch (error) {
      console.error('Delete category failed:', error);
      alert(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const handleAddDefaultCategories = async () => {
    if (!organization || !canManageDocuments()) return;
    
    try {
      const defaultCategories = DEFAULT_HR_CATEGORIES[language];
      
      for (const categoryData of defaultCategories) {
        // Check if category already exists
        const exists = categories.some(
          cat => cat.name.toLowerCase() === categoryData.name.toLowerCase()
        );
        
        if (!exists) {
          await createDocumentCategory(organization.id, categoryData);
        }
      }
      
      alert(t.defaultCategoriesAdded);
      await loadCategories();
    } catch (error) {
      console.error('Add default categories failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to add default categories');
    }
  };

  if (!organization) return null;

  return (
    <div 
      className={`bg-white rounded-lg shadow-lg p-6 ${className}`} 
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-saudi-navy-900 arabic-heading">
          {t.title}
        </h2>
        <div className="flex items-center space-x-2 space-x-reverse">
          {canManageDocuments() && (
            <Button
              onClick={handleStartCreate}
              className="bg-saudi-navy-600 hover:bg-saudi-navy-700"
              disabled={isCreating || editingId !== null}
            >
              <Plus className="h-4 w-4 me-2" />
              {t.createCategory}
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="mb-6 p-4 border border-saudi-navy-200 rounded-lg bg-saudi-navy-50">
          <h3 className="text-lg font-semibold text-saudi-navy-900 mb-4 arabic-heading">
            {isCreating ? t.createCategory : t.editCategory}
          </h3>
          
          <div className="space-y-4">
            {/* Category Name */}
            <div>
              <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                {t.categoryName} <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t.namePlaceholder}
                className="arabic-text"
                maxLength={100}
              />
            </div>

            {/* Category Description */}
            <div>
              <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                {t.categoryDescription}
              </label>
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t.descriptionPlaceholder}
                className="arabic-text"
                maxLength={255}
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-saudi-navy-700 mb-2">
                {t.categoryColor}
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`
                      w-8 h-8 rounded-full border-2 transition-all
                      ${formData.color === color 
                        ? 'border-saudi-navy-600 scale-110' 
                        : 'border-gray-300 hover:border-gray-400'
                      }
                    `}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 space-x-reverse pt-4">
              <Button variant="outline" onClick={handleCancelForm}>
                <X className="h-4 w-4 me-2" />
                {t.cancel}
              </Button>
              <Button 
                onClick={handleSaveCategory}
                className="bg-saudi-green-600 hover:bg-saudi-green-700"
              >
                <Save className="h-4 w-4 me-2" />
                {t.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Categories List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-saudi-navy-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-32 space-y-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-red-600">{error}</p>
          <Button onClick={loadCategories} variant="outline" size="sm">
            {t.cancel}
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 space-y-4">
          <FolderPlus className="h-12 w-12 text-gray-400" />
          <p className="text-gray-500 arabic-text">{t.noCategories}</p>
          {canManageDocuments() && (
            <Button
              onClick={handleAddDefaultCategories}
              variant="outline"
              className="border-saudi-navy-300 text-saudi-navy-700 hover:bg-saudi-navy-50"
            >
              <Plus className="h-4 w-4 me-2" />
              {t.addDefaultCategories}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`
                flex items-center justify-between p-4 border border-gray-200 rounded-lg
                hover:border-saudi-navy-300 transition-colors cursor-pointer
                ${onCategorySelect ? 'hover:bg-saudi-navy-50' : ''}
              `}
              onClick={() => onCategorySelect?.(category)}
            >
              <div className="flex items-center space-x-3 space-x-reverse flex-1">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <h3 className="font-medium text-saudi-navy-900 arabic-text">
                      {category.name}
                    </h3>
                    <Badge 
                      variant={category.is_system ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {category.is_system ? t.systemCategory : t.customCategory}
                    </Badge>
                  </div>
                  {category.description && (
                    <p className="text-sm text-gray-600 truncate arabic-text mt-1">
                      {category.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {canManageDocuments() && !category.is_system && (
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(category);
                    }}
                    className="text-gray-400 hover:text-saudi-navy-600"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(category);
                    }}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Default Categories Button */}
      {categories.length > 0 && categories.length < DEFAULT_HR_CATEGORIES[language].length && canManageDocuments() && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <Button
            onClick={handleAddDefaultCategories}
            variant="outline"
            className="w-full border-dashed border-saudi-navy-300 text-saudi-navy-700 hover:bg-saudi-navy-50"
          >
            <Plus className="h-4 w-4 me-2" />
            {t.addDefaultCategories}
          </Button>
        </div>
      )}
    </div>
  );
}