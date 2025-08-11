'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IoLogoGithub, IoLogoGoogle } from 'react-icons/io5';
import { Building2, Users, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { ActionResponse } from '@/types/action-response';
import { LanguageSwitcher, useTranslation } from '@/components/language-switcher';
import { OrganizationSignupForm, OrganizationSignupData } from '@/components/organization-signup-form';

interface AuthUIProps {
  mode: 'login' | 'signup';
  signInWithOAuth: (provider: 'github' | 'google') => Promise<ActionResponse>;
  signInWithEmail: (email: string) => Promise<ActionResponse>;
  signUpWithOrganization?: (data: OrganizationSignupData) => Promise<ActionResponse>;
}

export function AuthUI({
  mode,
  signInWithOAuth,
  signInWithEmail,
  signUpWithOrganization,
}: AuthUIProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [signupMode, setSignupMode] = useState<'selection' | 'organization' | 'invitation'>('selection');

  const titleMap = {
    login: {
      ar: 'تسجيل الدخول إلى منصة الاستشارات الذكية',
      en: 'Login to HR Intelligence Platform'
    },
    signup: {
      ar: 'انضم إلى منصة الاستشارات الذكية للموارد البشرية',
      en: 'Join the HR Intelligence Platform'
    }
  } as const;

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = event.target as HTMLFormElement;
    const email = form['email'].value;
    const response = await signInWithEmail(email);

    if (response?.error) {
      toast({
        variant: 'destructive',
        title: t({
          ar: 'خطأ في المصادقة',
          en: 'Authentication Error'
        }),
        description: t({
          ar: 'حدث خطأ أثناء المصادقة. يرجى المحاولة مرة أخرى.',
          en: 'An error occurred while authenticating. Please try again.'
        }),
      });
    } else {
      toast({
        title: t({
          ar: 'تم إرسال الرابط',
          en: 'Link Sent'
        }),
        description: t({
          ar: `للمتابعة، انقر على الرابط المرسل إلى: ${email}`,
          en: `To continue, click the link in the email sent to: ${email}`
        }),
      });
    }

    form.reset();
    setPending(false);
  }

  async function handleOAuthClick(provider: 'google' | 'github') {
    setPending(true);
    const response = await signInWithOAuth(provider);

    if (response?.error) {
      toast({
        variant: 'destructive',
        title: t({
          ar: 'خطأ في المصادقة',
          en: 'Authentication Error'
        }),
        description: t({
          ar: 'حدث خطأ أثناء المصادقة. يرجى المحاولة مرة أخرى.',
          en: 'An error occurred while authenticating. Please try again.'
        }),
      });
      setPending(false);
    }
  }

  async function handleOrganizationSignup(data: OrganizationSignupData) {
    if (!signUpWithOrganization) {
      throw new Error('Organization signup not available');
    }
    setPending(true);
    try {
      return await signUpWithOrganization(data);
    } finally {
      setPending(false);
    }
  }

  // Render organization signup form
  if (mode === 'signup' && signupMode === 'organization') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-saudi-navy-50 to-saudi-green-50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <button 
              onClick={() => setSignupMode('selection')}
              className="text-saudi-navy hover:text-saudi-navy-600 flex items-center gap-2"
            >
              ← {t({ ar: 'العودة', en: 'Back' })}
            </button>
            <LanguageSwitcher />
          </div>
          <OrganizationSignupForm 
            onSubmit={handleOrganizationSignup} 
            isLoading={pending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-saudi-navy-50 to-saudi-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Language Switcher */}
        <div className="flex justify-end mb-6">
          <LanguageSwitcher />
        </div>

        <div className="hr-card">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-saudi-navy rounded-full flex items-center justify-center">
              <Building2 size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-saudi-navy mb-2">
              {t(titleMap[mode])}
            </h1>
            <p className="text-gray-600 text-sm">
              {mode === 'login' 
                ? t({
                    ar: 'ادخل إلى حسابك للوصول لمنصة الاستشارات الذكية',
                    en: 'Access your account to use the intelligent consultation platform'
                  })
                : t({
                    ar: 'اختر طريقة التسجيل المناسبة لك',
                    en: 'Choose your preferred signup method'
                  })
              }
            </p>
          </div>

          {/* Signup Mode Selection */}
          {mode === 'signup' && signupMode === 'selection' && (
            <div className="space-y-4 mb-6">
              <button
                onClick={() => setSignupMode('organization')}
                className="w-full p-4 border-2 border-saudi-navy rounded-lg hover:bg-saudi-navy-50 transition-all group text-start"
                disabled={pending}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-saudi-navy rounded-lg flex items-center justify-center group-hover:bg-saudi-navy-600">
                    <Building2 size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-saudi-navy">
                      {t({
                        ar: 'إنشاء مؤسسة جديدة',
                        en: 'Create New Organization'
                      })}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t({
                        ar: 'ابدأ حساب جديد لمؤسستك',
                        en: 'Start a new account for your organization'
                      })}
                    </p>
                  </div>
                  <ArrowRight size={20} className="text-saudi-navy group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => setSignupMode('invitation')}
                className="w-full p-4 border-2 border-saudi-green rounded-lg hover:bg-saudi-green-50 transition-all group text-start"
                disabled={pending}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-saudi-green rounded-lg flex items-center justify-center group-hover:bg-saudi-green-600">
                    <Users size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-saudi-green">
                      {t({
                        ar: 'انضمام بدعوة',
                        en: 'Join by Invitation'
                      })}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t({
                        ar: 'لديك دعوة للانضمام لمؤسسة موجودة',
                        en: 'You have an invitation to join an existing organization'
                      })}
                    </p>
                  </div>
                  <ArrowRight size={20} className="text-saudi-green group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    {t({ ar: 'أو', en: 'or' })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* OAuth Buttons */}
          {(mode === 'login' || (mode === 'signup' && signupMode !== 'organization')) && (
            <div className="space-y-3 mb-6">
              <button
                className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-all bg-white"
                onClick={() => handleOAuthClick('google')}
                disabled={pending}
              >
                <IoLogoGoogle size={20} className="text-red-500" />
                <span className="font-medium text-gray-700">
                  {t({
                    ar: 'متابعة مع Google',
                    en: 'Continue with Google'
                  })}
                </span>
              </button>
              
              <button
                className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-all bg-white"
                onClick={() => handleOAuthClick('github')}
                disabled={pending}
              >
                <IoLogoGithub size={20} className="text-gray-800" />
                <span className="font-medium text-gray-700">
                  {t({
                    ar: 'متابعة مع GitHub',
                    en: 'Continue with GitHub'
                  })}
                </span>
              </button>

              {/* Email Option */}
              <Collapsible open={emailFormOpen} onOpenChange={setEmailFormOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-saudi-navy text-white rounded-lg hover:bg-saudi-navy-600 transition-all font-medium"
                    disabled={pending}
                  >
                    {t({
                      ar: 'متابعة مع البريد الإلكتروني',
                      en: 'Continue with Email'
                    })}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <form onSubmit={handleEmailSubmit}>
                      <Input
                        type="email"
                        name="email"
                        placeholder={t({
                          ar: 'أدخل بريدك الإلكتروني',
                          en: 'Enter your email'
                        })}
                        className="hr-input mb-4"
                        autoFocus
                        disabled={pending}
                      />
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setEmailFormOpen(false)}
                          className="flex-1"
                          disabled={pending}
                        >
                          {t({ ar: 'إلغاء', en: 'Cancel' })}
                        </Button>
                        <Button 
                          type="submit" 
                          className="flex-1 hr-button-primary"
                          disabled={pending}
                        >
                          {t({ ar: 'إرسال', en: 'Submit' })}
                        </Button>
                      </div>
                    </form>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Mode Switch */}
          <div className="text-center text-sm text-gray-600">
            {mode === 'login' ? (
              <span>
                {t({
                  ar: 'ليس لديك حساب؟',
                  en: "Don't have an account?"
                })}{' '}
                <Link href="/signup" className="text-saudi-navy hover:underline font-medium">
                  {t({
                    ar: 'سجل الآن',
                    en: 'Sign up'
                  })}
                </Link>
              </span>
            ) : (
              <span>
                {t({
                  ar: 'لديك حساب بالفعل؟',
                  en: 'Already have an account?'
                })}{' '}
                <Link href="/login" className="text-saudi-navy hover:underline font-medium">
                  {t({
                    ar: 'سجل الدخول',
                    en: 'Sign in'
                  })}
                </Link>
              </span>
            )}
          </div>

          {/* Terms and Privacy */}
          {mode === 'signup' && (
            <p className="mt-6 text-xs text-gray-500 text-center">
              {t({
                ar: 'بالنقر على متابعة، فإنك توافق على',
                en: 'By clicking continue, you agree to our'
              })}{' '}
              <Link href="/terms" className="text-saudi-navy hover:underline">
                {t({
                  ar: 'شروط الخدمة',
                  en: 'Terms of Service'
                })}
              </Link>{' '}
              {t({ ar: 'و', en: 'and' })}{' '}
              <Link href="/privacy" className="text-saudi-navy hover:underline">
                {t({
                  ar: 'سياسة الخصوصية',
                  en: 'Privacy Policy'
                })}
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
