import { ICON_DEFS, ACCENT_HEX, homeAngle, toXY, type SectionKey } from './data';

interface AnimatedRingProps {
  size: number;
  availableKeys: SectionKey[];
}

export default function AnimatedRing({ size, availableKeys }: AnimatedRingProps) {
  const radius = size / 2 - 25;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#678D41"
        strokeWidth={1.5}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.5}
        style={{ transformOrigin: '50% 50%', transform: 'rotate(180deg)' }}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#F8862F"
        strokeWidth={1.5}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.5}
        style={{ transformOrigin: '50% 50%', transform: 'rotate(0deg)' }}
      />
      {availableKeys.map((key, index) => {
        const angle = homeAngle(index, availableKeys.length);
        const { x, y } = toXY(angle, radius);
        const accentHex = ACCENT_HEX[ICON_DEFS[key].accent];
        return <circle key={key} cx={center + x} cy={center + y} r={5} fill={accentHex} stroke="#FFF" strokeWidth={1.5} />;
      })}
    </svg>
  );
}
