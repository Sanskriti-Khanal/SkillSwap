import { useMemo, useState } from 'react';
import './tailwind-hero.css';
import { buildHeroSections, availableSectionKeys, type PublicProfileResponse, type ReviewItem, type SectionKey } from './data';
import TutorCircle from './TutorCircle';
import DynamicContent from './DynamicContent';

interface HeroProps {
  data: PublicProfileResponse;
  reviews: ReviewItem[];
}

export default function Hero({ data, reviews }: HeroProps) {
  const sections = useMemo(() => buildHeroSections(data, reviews), [data, reviews]);
  const availableKeys = useMemo(() => availableSectionKeys(sections), [sections]);
  const [activeKey, setActiveKey] = useState<SectionKey>('profile');

  return (
    <section 
      className="relative overflow-hidden bg-[var(--color-hero-bg)] px-8 py-10 sm:px-12 lg:px-20 font-sans min-h-[640px] flex flex-col font-sans border-b border-gray-100 rounded-3xl max-w-6xl mx-auto my-4"
      style={{ backgroundImage: "url('/hero-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}
    >

      <div className="relative z-10 flex-1 grid grid-cols-1 items-center gap-12 lg:grid-cols-2 max-w-7xl mx-auto w-full">
        {/* Left: dynamic content */}
        <div className="order-2 lg:order-1 flex flex-col justify-center">
          <DynamicContent activeKey={activeKey} sections={sections} />
        </div>

        {/* Right: orbiting profile circle */}
        <div className="order-1 flex justify-center lg:order-2">
          <TutorCircle
            name={sections.profile.name}
            avatarUrl={sections.profile.avatarUrl}
            availableKeys={availableKeys}
            activeKey={activeKey}
            onSelect={setActiveKey}
          />
        </div>
      </div>
    </section>
  );
}

