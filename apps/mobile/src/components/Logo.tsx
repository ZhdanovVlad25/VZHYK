import Svg, { Circle, Defs, Ellipse, Rect, ClipPath, G } from 'react-native-svg';

type LogoProps = {
  size?: number;
};

/**
 * RN-порт apps/web/src/components/layout/Logo.tsx — той самий маскот "Вжик":
 * бірюзовий квадрат, жовті квадратні очі, чорний ніс-овал, двотонний червоний
 * светр знизу. SVG-розмітка ідентична, без анімації блимання (web-only CSS keyframes).
 */
export function Logo({ size = 40 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <ClipPath id="vzhykClip">
          <Rect x={0} y={0} width={200} height={200} rx={40} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={200} height={200} rx={40} fill="#238A80" />
      <Rect x={25} y={45} width={70} height={70} rx={16} fill="#F0C94A" />
      <Rect x={105} y={45} width={70} height={70} rx={16} fill="#F0C94A" />
      <G>
        <Circle cx={65} cy={90} r={14} fill="#1A1A1A" />
        <Circle cx={61} cy={86} r={3} fill="#FFFFFF" />
      </G>
      <G>
        <Circle cx={135} cy={90} r={14} fill="#1A1A1A" />
        <Circle cx={131} cy={86} r={3} fill="#FFFFFF" />
      </G>
      <Ellipse cx={100} cy={140} rx={16} ry={10} fill="#1A1A1A" />
      <Circle cx={94} cy={136} r={3} fill="#FFFFFF" />
      <Rect x={0} y={170} width={200} height={14} fill="#E13B32" clipPath="url(#vzhykClip)" />
      <Rect x={0} y={184} width={200} height={16} fill="#9B241D" clipPath="url(#vzhykClip)" />
    </Svg>
  );
}
