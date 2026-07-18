import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import AnimatedRing from './AnimatedRing';
import { ICON_DEFS, ACCENT_HEX, homeAngle, toXY, type SectionKey } from './data';

interface TutorCircleProps {
  name: string;
  avatarUrl?: string | null;
  availableKeys: SectionKey[];
  activeKey: SectionKey;
  onSelect: (key: SectionKey) => void;
}

const PHOTO_SIZE = 240;
const RING_SIZE = 360;
const ACTIVE_ANGLE = 180;
const HOME_RADIUS = 155; // RING_SIZE / 2 - 25
const ACTIVE_RADIUS = 155; // Keep active on the same ring or slightly offset

export default function TutorCircle({ name, avatarUrl, availableKeys, activeKey, onSelect }: TutorCircleProps) {
  return (
    <div
      className="relative mx-auto flex items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <AnimatedRing size={RING_SIZE} availableKeys={availableKeys} />

      {/* Center profile photo */}
      <motion.div
        className="absolute rounded-full border-[6px] border-white shadow-sm bg-white flex items-center justify-center overflow-hidden text-orange-500 font-bold z-10"
        style={{
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          left: (RING_SIZE - PHOTO_SIZE) / 2,
          top: (RING_SIZE - PHOTO_SIZE) / 2,
        }}
        animate={{ scale: [1, 1.015, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        key={activeKey}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-300">
            <User size={PHOTO_SIZE * 0.45} strokeWidth={1.5} />
          </div>
        )}
      </motion.div>

      {/* Orbiting icon buttons */}
      {availableKeys.map((key, index) => {
        const def = ICON_DEFS[key];
        const Icon = def.icon;
        const accentHex = ACCENT_HEX[def.accent];
        const isActive = key === activeKey;
        const angle = isActive ? ACTIVE_ANGLE : homeAngle(index, availableKeys.length);
        const radius = isActive ? ACTIVE_RADIUS : HOME_RADIUS;
        const { x, y } = toXY(angle, radius);
        const btnSize = isActive ? 72 : 60;

        return (
          <motion.button
            key={key}
            type="button"
            aria-label={def.label}
            aria-pressed={isActive}
            title={def.label}
            onClick={() => onSelect(key)}
            className="absolute flex items-center justify-center rounded-full cursor-pointer group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 z-20"
            style={{
              width: btnSize,
              height: btnSize,
              left: RING_SIZE / 2 - btnSize / 2,
              top: RING_SIZE / 2 - btnSize / 2,
            }}
            animate={{ x, y }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            whileTap={{ scale: 0.92 }}
          >
            <span
              className={`flex h-full w-full items-center justify-center rounded-full bg-white transition-[transform,box-shadow] duration-300 ease-in-out hover:shadow-xl ${
                isActive ? 'scale-110 shadow-lg' : 'shadow-md hero-icon-idle-pulse'
              }`}
              style={{
                color: accentHex,
                animationDelay: isActive ? undefined : `${index * 0.3}s`,
              }}
            >
              <Icon size={isActive ? 30 : 24} strokeWidth={2.5} />
            </span>
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {def.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
