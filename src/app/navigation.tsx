import Link from 'next/link';
import { IoMenu } from 'react-icons/io5';
import { MessageSquare, FileText, BarChart3 } from 'lucide-react';

import { AccountMenu } from '@/components/account-menu';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTrigger } from '@/components/ui/sheet';
import { getSession } from '@/features/account/controllers/get-session';
import { cn } from '@/utils/cn';

import { signOut } from './(auth)/auth-actions';

export async function Navigation() {
  const session = await getSession();

  const navigationItems = [
    {
      href: '/chat',
      label: 'المساعد الذكي',
      labelEn: 'AI Assistant',
      icon: MessageSquare,
      description: 'استشر المساعد الذكي للموارد البشرية',
    },
    {
      href: '/documents',
      label: 'المستندات',
      labelEn: 'Documents',
      icon: FileText,
      description: 'إدارة مستندات ووثائق الموارد البشرية',
    },
    {
      href: '/analytics',
      label: 'التحليلات',
      labelEn: 'Analytics',
      icon: BarChart3,
      description: 'تحليلات وتقارير الأداء',
    },
  ];

  return (
    <div className='relative flex items-center gap-6'>
      {session ? (
        <>
          {/* Desktop Navigation */}
          <nav className='hidden lg:flex items-center gap-6'>
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  'text-gray-600 hover:text-saudi-navy-700 hover:bg-gray-100',
                  'font-arabic'
                )}
              >
                <item.icon className='w-4 h-4' />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          
          <AccountMenu signOut={signOut} />
          
          {/* Mobile Navigation */}
          <Sheet>
            <SheetTrigger className='block lg:hidden'>
              <IoMenu size={28} />
            </SheetTrigger>
            <SheetContent className='w-full bg-white' side='right'>
              <SheetHeader>
                <Logo />
                <SheetDescription asChild>
                  <nav className='py-8 space-y-4'>
                    {navigationItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors',
                          'font-arabic'
                        )}
                      >
                        <item.icon className='w-5 h-5 text-saudi-navy-600' />
                        <div className='text-right'>
                          <div className='font-medium'>{item.label}</div>
                          <div className='text-xs text-gray-500 mt-1'>{item.description}</div>
                        </div>
                      </Link>
                    ))}
                  </nav>
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <>
          <Button variant='sexy' className='hidden flex-shrink-0 lg:flex' asChild>
            <Link href='/signup'>Get started for free</Link>
          </Button>
          <Sheet>
            <SheetTrigger className='block lg:hidden'>
              <IoMenu size={28} />
            </SheetTrigger>
            <SheetContent className='w-full bg-black'>
              <SheetHeader>
                <Logo />
                <SheetDescription className='py-8'>
                  <Button variant='sexy' className='flex-shrink-0' asChild>
                    <Link href='/signup'>Get started for free</Link>
                  </Button>
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
