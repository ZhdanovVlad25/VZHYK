import { useId } from 'react';
import { cn } from '@/lib/cn';

type LogoProps = {
  className?: string;
  /** Лого-лоадер: легке підстрибування + періодичне блимання очима (LoadingState, States.tsx). */
  animated?: boolean;
};

/**
 * Фінальне лого "Вжик" — обране після кількох раундів ітерацій (docs/design.md,
 * розділ "Лого"). Квадрат із заокругленими кутами (бірюза), два жовті
 * квадратні ока з великими зіницями й відблиском (теплий погляд донизу-
 * всередину, не "здивований"), чорний ніс-овал з відблиском, двотонний
 * червоний светр на всю ширину знизу (не рот).
 */
export function Logo({ className, animated = false }: LogoProps) {
  // useId(), не хардкод — Logo тепер рендериться кілька разів на сторінці одночасно
  // (хедер + LoadingState), дублікат id у <clipPath> ламав би clip у другому інстансі.
  const clipId = useId();
  const eyeStyle = animated ? { transformBox: 'fill-box' as const, transformOrigin: 'center' } : undefined;

  return (
    <svg
      viewBox="0 0 200 200"
      className={cn(className, animated && 'motion-safe:animate-bounce')}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="200" height="200" rx="40" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="200" height="200" rx="40" fill="#238A80" />
      <rect x="25" y="45" width="70" height="70" rx="16" fill="#F0C94A" />
      <rect x="105" y="45" width="70" height="70" rx="16" fill="#F0C94A" />
      <g className={animated ? 'motion-safe:animate-vzhyk-blink' : undefined} style={eyeStyle}>
        <circle cx="65" cy="90" r="14" fill="#1A1A1A" />
        <circle cx="61" cy="86" r="3" fill="#FFFFFF" />
      </g>
      <g className={animated ? 'motion-safe:animate-vzhyk-blink' : undefined} style={eyeStyle}>
        <circle cx="135" cy="90" r="14" fill="#1A1A1A" />
        <circle cx="131" cy="86" r="3" fill="#FFFFFF" />
      </g>
      <ellipse cx="100" cy="140" rx="16" ry="10" fill="#1A1A1A" />
      <circle cx="94" cy="136" r="3" fill="#FFFFFF" />
      <rect x="0" y="170" width="200" height="14" fill="#E13B32" clipPath={`url(#${clipId})`} />
      <rect x="0" y="184" width="200" height="16" fill="#9B241D" clipPath={`url(#${clipId})`} />
    </svg>
  );
}
