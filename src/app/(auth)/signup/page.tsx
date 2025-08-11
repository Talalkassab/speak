import { redirect } from 'next/navigation';

import { getSession } from '@/features/account/controllers/get-session';
import { getSubscription } from '@/features/account/controllers/get-subscription';

import { signInWithEmail, signInWithOAuth, signUpWithOrganization } from '../auth-actions';
import { AuthUI } from '../auth-ui';

export default async function SignUp() {
  const session = await getSession();
  const subscription = await getSubscription();

  if (session && subscription) {
    redirect('/account');
  }

  if (session && !subscription) {
    redirect('/pricing');
  }

  return (
    <AuthUI 
      mode='signup' 
      signInWithOAuth={signInWithOAuth} 
      signInWithEmail={signInWithEmail}
      signUpWithOrganization={signUpWithOrganization}
    />
  );
}
