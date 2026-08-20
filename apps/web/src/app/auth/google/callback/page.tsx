'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LoadingState, ErrorState } from '@/components/ui';

/** useSearchParams() вимагає Suspense-межу в App Router. */
export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<LoadingState label="Завершуємо вхід через Google…" />}>
      <GoogleCallbackContent />
    </Suspense>
  );
}

function GoogleCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { loginWithTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    if (!accessToken || !refreshToken) {
      setError('Не вдалося увійти через Google: відсутні токени в редіректі.');
      return;
    }
    loginWithTokens(accessToken, refreshToken)
      .then(({ needsName, needsPhone }) => router.replace(needsName || needsPhone ? '/login?complete=1' : '/'))
      .catch(() => setError('Не вдалося завершити вхід через Google.'));
  }, [params, loginWithTokens, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState description={error} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <LoadingState label="Завершуємо вхід через Google…" />
    </div>
  );
}
