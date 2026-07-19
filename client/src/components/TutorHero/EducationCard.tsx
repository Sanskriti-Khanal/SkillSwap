import { GraduationCap, Award } from 'lucide-react';
import type { HeroSections } from './data';

export default function EducationCard({ data }: { data: HeroSections['education'] }) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1E1E1E] mb-1">Education</h2>
      <p className="text-[#666] mb-6">Academic background and credentials.</p>

      {(data.highestEducation || data.institution) && (
        <div className="mb-6">
          <div className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-sm max-w-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#F97316]">
              <GraduationCap size={16} />
            </span>
            <div>
              {data.highestEducation && (
                <div className="font-semibold text-[#1E1E1E] capitalize">{data.highestEducation.replace(/_/g, ' ')}</div>
              )}
              {data.fieldOfStudy && <div className="text-sm text-[#666]">{data.fieldOfStudy}</div>}
              {data.institution && <div className="text-xs text-[#666] mt-0.5">{data.institution}</div>}
            </div>
          </div>
        </div>
      )}

      {data.certifications.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#666] mb-3">Certificates</h3>
          <div className="grid gap-2 max-w-md">
            {data.certifications.map((cert, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-50 text-[#84CC16]">
                  <Award size={16} />
                </span>
                <div>
                  <div className="text-sm font-semibold text-[#1E1E1E]">{cert.name}</div>
                  {cert.issuing_organization && <div className="text-xs text-[#666]">{cert.issuing_organization}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
