import { Star } from 'lucide-react';
import type { HeroSections } from './data';

export default function ProfileCard({ data }: { data: HeroSections['profile'] }) {
  return (
    <div>
      <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-hero-text)] mb-2 leading-tight tracking-tight">
        {data.name}
      </h1>
      {data.title && <p className="text-xl text-gray-500 mb-4 font-medium">{data.title}</p>}

      {(data.rating !== undefined || (data.languages && data.languages.length > 0)) && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {data.rating !== undefined && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium shadow-sm">
              <Star size={15} className="fill-orange-400 text-orange-400" />
              {data.rating.toFixed(1)} ({data.reviewCount})
            </span>
          )}
          {data.languages && data.languages.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#666] shadow-sm">
              {data.languages.join(', ')}
            </span>
          )}
        </div>
      )}

      {data.skills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 max-w-md">
          {data.skills.map((skill) => (
            <span key={skill} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#1E1E1E] shadow-sm">
              {skill}
            </span>
          ))}
        </div>
      )}

    </div>
  );
}
