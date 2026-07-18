import { Mail, Globe, ExternalLink } from 'lucide-react';
import type { HeroSections } from './data';

function ContactRow({ icon: Icon, label, href }: { icon: typeof Mail; label: string; href: string }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#F8862F]">
        <Icon size={20} />
      </span>
      <span className="text-lg font-bold text-[var(--color-hero-text)] truncate">{label}</span>
    </a>
  );
}

export default function ContactCard({ data }: { data: HeroSections['contact'] }) {
  return (
    <div className="pl-4 md:pl-8 lg:pl-12 pt-8">
      <h2 className="text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] font-extrabold text-[var(--color-hero-text)] mb-4 leading-none tracking-tight">Contact Tutor</h2>
      <p className="text-2xl md:text-3xl text-gray-500 mb-12 font-medium tracking-wide">Reach out directly — happy to answer any questions.</p>

      <div className="grid gap-4 max-w-lg mb-12">
        <ContactRow icon={Mail} label={data.email} href={`mailto:${data.email}`} />
        {data.website && <ContactRow icon={Globe} label="Website" href={data.website} />}
        {data.github && <ContactRow icon={ExternalLink} label="GitHub" href={data.github} />}
        {data.linkedin && <ContactRow icon={ExternalLink} label="LinkedIn" href={data.linkedin} />}
      </div>

      <a href={`mailto:${data.email}`} className="btn btn-primary btn-lg inline-flex w-full max-w-sm">
        Send Message
      </a>
    </div>
  );
}
