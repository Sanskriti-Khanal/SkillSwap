import { Mail, Globe, ExternalLink } from 'lucide-react';
import type { HeroSections } from './data';
import CtaButton from './CtaButton';

function ContactRow({ icon: Icon, label, href }: { icon: typeof Mail; label: string; href: string }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#F97316]">
        <Icon size={16} />
      </span>
      <span className="text-sm font-medium text-[#1E1E1E] truncate">{label}</span>
    </a>
  );
}

export default function ContactCard({ data }: { data: HeroSections['contact'] }) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1E1E1E] mb-1">Contact Tutor</h2>
      <p className="text-[#666] mb-6">Reach out directly — happy to answer any questions.</p>

      <div className="grid gap-3 max-w-md mb-6">
        <ContactRow icon={Mail} label={data.email} href={`mailto:${data.email}`} />
        {data.website && <ContactRow icon={Globe} label="Website" href={data.website} />}
        {data.github && <ContactRow icon={ExternalLink} label="GitHub" href={data.github} />}
        {data.linkedin && <ContactRow icon={ExternalLink} label="LinkedIn" href={data.linkedin} />}
      </div>

      <CtaButton href={`mailto:${data.email}`}>Send Message</CtaButton>
    </div>
  );
}
