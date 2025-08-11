'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { ActionResponse } from '@/types/action-response';
import { useTranslation } from '@/components/language-switcher';
import { Building2, User, Phone, Mail, Lock, Globe } from 'lucide-react';

export interface OrganizationSignupData {
  email: string;
  password: string;
  companyName: string;
  companyDomain?: string;
  adminFirstName: string;
  adminLastName: string;
  phoneNumber?: string;
  industry?: string;
}

interface OrganizationSignupFormProps {
  onSubmit: (data: OrganizationSignupData) => Promise<ActionResponse>;
  isLoading?: boolean;
}

const industryOptions = [
  { value: 'technology', labelAr: 'التكنولوجيا', labelEn: 'Technology' },
  { value: 'healthcare', labelAr: 'الرعاية الصحية', labelEn: 'Healthcare' },
  { value: 'finance', labelAr: 'الخدمات المالية', labelEn: 'Finance' },
  { value: 'education', labelAr: 'التعليم', labelEn: 'Education' },
  { value: 'retail', labelAr: 'البيع بالتجزئة', labelEn: 'Retail' },
  { value: 'manufacturing', labelAr: 'التصنيع', labelEn: 'Manufacturing' },
  { value: 'construction', labelAr: 'البناء والتشييد', labelEn: 'Construction' },
  { value: 'consulting', labelAr: 'الاستشارات', labelEn: 'Consulting' },
  { value: 'government', labelAr: 'الحكومة', labelEn: 'Government' },
  { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
];

export function OrganizationSignupForm({ onSubmit, isLoading = false }: OrganizationSignupFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<OrganizationSignupData>({
    email: '',
    password: '',
    companyName: '',
    companyDomain: '',
    adminFirstName: '',
    adminLastName: '',
    phoneNumber: '',
    industry: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OrganizationSignupData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof OrganizationSignupData, string>> = {};

    // Required fields validation
    if (!formData.email) {
      newErrors.email = t({
        ar: 'البريد الإلكتروني مطلوب',
        en: 'Email is required'
      });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t({
        ar: 'يرجى إدخال بريد إلكتروني صحيح',
        en: 'Please enter a valid email'
      });
    }

    if (!formData.password) {
      newErrors.password = t({
        ar: 'كلمة المرور مطلوبة',
        en: 'Password is required'
      });
    } else if (formData.password.length < 8) {
      newErrors.password = t({
        ar: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
        en: 'Password must be at least 8 characters'
      });
    }

    if (!formData.companyName) {
      newErrors.companyName = t({
        ar: 'اسم الشركة مطلوب',
        en: 'Company name is required'
      });
    }

    if (!formData.adminFirstName) {
      newErrors.adminFirstName = t({
        ar: 'الاسم الأول مطلوب',
        en: 'First name is required'
      });
    }

    if (!formData.adminLastName) {
      newErrors.adminLastName = t({
        ar: 'اسم العائلة مطلوب',
        en: 'Last name is required'
      });
    }

    // Phone number validation (Saudi format)
    if (formData.phoneNumber && !/^05\d{8}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = t({
        ar: 'يرجى إدخال رقم هاتف صحيح (05XXXXXXXX)',
        en: 'Please enter a valid phone number (05XXXXXXXX)'
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const response = await onSubmit(formData);
      
      if (response?.error) {
        toast({
          variant: 'destructive',
          title: t({
            ar: 'خطأ في إنشاء الحساب',
            en: 'Account Creation Error'
          }),
          description: response.error.message || t({
            ar: 'حدث خطأ أثناء إنشاء حسابك. يرجى المحاولة مرة أخرى.',
            en: 'An error occurred while creating your account. Please try again.'
          }),
        });
      } else {
        toast({
          title: t({
            ar: 'تم إنشاء الحساب بنجاح',
            en: 'Account Created Successfully'
          }),
          description: t({
            ar: 'تم إنشاء حساب شركتكم بنجاح. يرجى التحقق من بريدكم الإلكتروني لتفعيل الحساب.',
            en: 'Your organization account has been created successfully. Please check your email to verify your account.'
          }),
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t({
          ar: 'خطأ غير متوقع',
          en: 'Unexpected Error'
        }),
        description: t({
          ar: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
          en: 'An unexpected error occurred. Please try again.'
        }),
      });
    }
  };

  const handleInputChange = (field: keyof OrganizationSignupData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="hr-card max-w-2xl mx-auto">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-saudi-navy mb-2">
          {t({
            ar: 'إنشاء حساب مؤسسة جديدة',
            en: 'Create New Organization Account'
          })}
        </h2>
        <p className="text-gray-600">
          {t({
            ar: 'ابدأ رحلتك مع منصة الاستشارات الذكية للموارد البشرية',
            en: 'Start your journey with our intelligent HR consultation platform'
          })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organization Information */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-saudi-navy mb-4 flex items-center gap-2">
            <Building2 size={20} />
            {t({
              ar: 'معلومات المؤسسة',
              en: 'Organization Information'
            })}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t({
                  ar: 'اسم الشركة *',
                  en: 'Company Name *'
                })}
              </label>
              <Input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                className={`hr-input ${errors.companyName ? 'border-red-500' : ''}`}
                placeholder={t({
                  ar: 'أدخل اسم شركتكم',
                  en: 'Enter your company name'
                })}
                disabled={isLoading}
              />
              {errors.companyName && (
                <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="inline w-4 h-4 mr-1" />
                {t({
                  ar: 'نطاق الشركة (اختياري)',
                  en: 'Company Domain (Optional)'
                })}
              </label>
              <Input
                type="text"
                value={formData.companyDomain}
                onChange={(e) => handleInputChange('companyDomain', e.target.value)}
                className="hr-input"
                placeholder={t({
                  ar: 'example.com',
                  en: 'example.com'
                })}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t({
                  ar: 'القطاع',
                  en: 'Industry'
                })}
              </label>
              <select
                value={formData.industry}
                onChange={(e) => handleInputChange('industry', e.target.value)}
                className="hr-input"
                disabled={isLoading}
              >
                <option value="">
                  {t({
                    ar: 'اختر القطاع',
                    en: 'Select Industry'
                  })}
                </option>
                {industryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t({
                      ar: option.labelAr,
                      en: option.labelEn
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Administrator Information */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-saudi-navy mb-4 flex items-center gap-2">
            <User size={20} />
            {t({
              ar: 'معلومات المدير',
              en: 'Administrator Information'
            })}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t({
                  ar: 'الاسم الأول *',
                  en: 'First Name *'
                })}
              </label>
              <Input
                type="text"
                value={formData.adminFirstName}
                onChange={(e) => handleInputChange('adminFirstName', e.target.value)}
                className={`hr-input ${errors.adminFirstName ? 'border-red-500' : ''}`}
                placeholder={t({
                  ar: 'الاسم الأول',
                  en: 'First Name'
                })}
                disabled={isLoading}
              />
              {errors.adminFirstName && (
                <p className="text-red-500 text-sm mt-1">{errors.adminFirstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t({
                  ar: 'اسم العائلة *',
                  en: 'Last Name *'
                })}
              </label>
              <Input
                type="text"
                value={formData.adminLastName}
                onChange={(e) => handleInputChange('adminLastName', e.target.value)}
                className={`hr-input ${errors.adminLastName ? 'border-red-500' : ''}`}
                placeholder={t({
                  ar: 'اسم العائلة',
                  en: 'Last Name'
                })}
                disabled={isLoading}
              />
              {errors.adminLastName && (
                <p className="text-red-500 text-sm mt-1">{errors.adminLastName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="inline w-4 h-4 mr-1" />
                {t({
                  ar: 'البريد الإلكتروني *',
                  en: 'Email Address *'
                })}
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`hr-input ${errors.email ? 'border-red-500' : ''}`}
                placeholder={t({
                  ar: 'admin@company.com',
                  en: 'admin@company.com'
                })}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="inline w-4 h-4 mr-1" />
                {t({
                  ar: 'رقم الهاتف',
                  en: 'Phone Number'
                })}
              </label>
              <Input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className={`hr-input ${errors.phoneNumber ? 'border-red-500' : ''}`}
                placeholder="05XXXXXXXX"
                disabled={isLoading}
              />
              {errors.phoneNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="inline w-4 h-4 mr-1" />
              {t({
                ar: 'كلمة المرور *',
                en: 'Password *'
              })}
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`hr-input ${errors.password ? 'border-red-500' : ''}`}
              placeholder={t({
                ar: 'أدخل كلمة مرور قوية',
                en: 'Enter a strong password'
              })}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            type="submit"
            className="w-full hr-button-primary text-lg py-4"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t({
                  ar: 'جاري إنشاء الحساب...',
                  en: 'Creating Account...'
                })}
              </div>
            ) : (
              t({
                ar: 'إنشاء حساب المؤسسة',
                en: 'Create Organization Account'
              })
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}