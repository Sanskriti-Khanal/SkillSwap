import type { HeroSections } from './data';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#666] mb-2">{title}</h3>
      {children}
    </div>
  );
}

export default function ResumeCard({ data }: { data: HeroSections['resume'] }) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1E1E1E] mb-1">Curriculum Vitae</h2>
      <p className="text-[#666] mb-6">A structured summary built from their verified profile.</p>

      <div className="max-w-md rounded-2xl bg-white p-6 shadow-md">
        {data.about && (
          <Section title="About">
            <p className="text-sm text-[#1E1E1E] leading-relaxed">{data.about}</p>
          </Section>
        )}

        {data.experienceLine && (
          <Section title="Experience">
            <p className="text-sm text-[#1E1E1E]">{data.experienceLine}</p>
          </Section>
        )}

        {data.educationLine && (
          <Section title="Education">
            <p className="text-sm text-[#1E1E1E] capitalize">
              {data.educationLine.replace(/_/g, ' ')}
              {data.fieldOfStudy && ` — ${data.fieldOfStudy}`}
            </p>
          </Section>
        )}

        {data.skills.length > 0 && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s) => (
                <span key={s} className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-[#F97316]">{s}</span>
              ))}
            </div>
          </Section>
        )}

        {data.languages.length > 0 && (
          <Section title="Languages">
            <p className="text-sm text-[#1E1E1E]">{data.languages.join(', ')}</p>
          </Section>
        )}

        {data.certifications.length > 0 && (
          <Section title="Certifications">
            <ul className="text-sm text-[#1E1E1E] space-y-1">
              {data.certifications.map((c, i) => (
                <li key={i}>{c.name}{c.issuing_organization && ` — ${c.issuing_organization}`}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}
