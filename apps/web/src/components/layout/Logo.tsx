type LogoProps = {
  className?: string;
};

/**
 * Фінальне лого "Вжик" — обране після кількох раундів ітерацій (docs/design.md,
 * розділ "Лого"). Квадрат із заокругленими кутами (бірюза), два жовті
 * квадратні ока з великими зіницями й відблиском (теплий погляд донизу-
 * всередину, не "здивований"), чорний ніс-овал з відблиском, двотонний
 * червоний светр на всю ширину знизу (не рот).
 */
export function Logo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <defs>
        <clipPath id="vzhyk-logo-clip">
          <rect x="0" y="0" width="200" height="200" rx="40" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="200" height="200" rx="40" fill="#238A80" />
      <rect x="25" y="45" width="70" height="70" rx="16" fill="#F0C94A" />
      <rect x="105" y="45" width="70" height="70" rx="16" fill="#F0C94A" />
      <circle cx="65" cy="90" r="14" fill="#1A1A1A" />
      <circle cx="61" cy="86" r="3" fill="#FFFFFF" />
      <circle cx="135" cy="90" r="14" fill="#1A1A1A" />
      <circle cx="131" cy="86" r="3" fill="#FFFFFF" />
      <ellipse cx="100" cy="140" rx="16" ry="10" fill="#1A1A1A" />
      <circle cx="94" cy="136" r="3" fill="#FFFFFF" />
      <rect x="0" y="170" width="200" height="14" fill="#E13B32" clipPath="url(#vzhyk-logo-clip)" />
      <rect x="0" y="184" width="200" height="16" fill="#9B241D" clipPath="url(#vzhyk-logo-clip)" />
    </svg>
  );
}
