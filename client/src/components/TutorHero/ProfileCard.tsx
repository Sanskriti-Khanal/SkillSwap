import type { HeroSections } from './data';
import CtaButton from './CtaButton';

export default function ProfileCard({ data }: { data: HeroSections['profile'] }) {
  return (
    <div className="pl-4 md:pl-8 lg:pl-12 pt-8">
      <h1 className="text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] font-extrabold text-[var(--color-hero-text)] mb-4 leading-none tracking-tight">
        {data.title || 'E-Learning'}
      </h1>
      <p className="text-2xl md:text-3xl text-gray-500 mb-12 font-medium tracking-wide">
        {data.name}
      </p>

      <CtaButton href={data.bookHref}>BENEFITS</CtaButton>
    </div>
  );
}
