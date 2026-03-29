'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <SignIn signUpUrl="/sign-up" />
    </div>
  );
}
