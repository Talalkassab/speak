import Image from 'next/image';
import Link from 'next/link';

export function Logo() {
  return (
    <Link href='/' className='flex w-fit items-center gap-2'>
      <Image
        src='/logo.png'
        width={40}
        height={40}
        priority
        quality={100}
        alt='My SaaS App logo mark'
      />
      <span className='font-alt text-xl text-white'>My SaaS App</span>
    </Link>
  );
}
