import { Briefcase, Award } from 'lucide-react';
import type { HeroSections } from './data';

export default function ExperienceCard({ data }: { data: HeroSections['experience'] }) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1E1E1E] mb-1">Experience & Skills</h2>
      <p className="text-[#666] mb-6">A snapshot of their background.</p>

      {data.currentTitle && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#666] mb-3">Experience</h3>
          <div className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-sm max-w-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-50 text-[#84CC16]">
              <Briefcase size={16} />
            </span>
            <div>
              <div className="font-semibold text-[#1E1E1E]">{data.currentTitle}</div>
              {data.currentCompany && <div className="text-sm text-[#666]">{data.currentCompany}</div>}
              {data.yearsExperience != null && <div className="text-xs text-[#666] mt-0.5">{data.yearsExperience} years experience</div>}
            </div>
          </div>
        </div>
      )}

      {data.skills.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#666] mb-3">Skills</h3>
          <div className="flex flex-wrap gap-2 max-w-md">
            {data.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#1E1E1E] shadow-sm">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.certifications.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#666] mb-3">Certificates</h3>
          <div className="grid gap-2 max-w-md">
            {data.certifications.map((cert, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#F97316]">
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
