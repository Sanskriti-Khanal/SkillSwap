import { useState } from 'react';
import { Mail, Globe, ExternalLink } from 'lucide-react';
import type { HeroSections } from './data';

function ContactRow({ icon: Icon, label, href }: { icon: typeof Mail; label: string; href: string }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-4 rounded-[20px] bg-white px-5 py-[14px] shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_4px_15px_rgba(0,0,0,0.08)] focus-visible:outline-none"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFDAC6] text-[#DF541D]">
        <Icon size={18} strokeWidth={1.5} />
      </span>
      <span className="text-[17px] font-normal text-[#222] truncate">{label}</span>
    </a>
  );
}

export default function ContactCard({ data }: { data: HeroSections['contact'] }) {
  const [message, setMessage] = useState('');

  const mailtoHref = `mailto:${data.email}${message.trim() ? `?body=${encodeURIComponent(message.trim())}` : ''}`;

  return (
    <div className="w-full max-w-[460px]">
      <h2 className="text-[2.75rem] font-bold text-[#111] mb-2 leading-tight">Contact Tutor</h2>
      <p className="text-[1.25rem] text-[#333] mb-8 font-normal leading-[1.4] pr-4">
        Reach out directly — happy to answer any questions.
      </p>

      <div className="grid gap-[14px] w-full mb-6">
        <ContactRow icon={Mail} label={data.email} href={`mailto:${data.email}`} />
        {data.linkedin && <ContactRow icon={Globe} label="Linkedin /Dribble/Behance/Portfolio" href={data.linkedin} />}
        {!data.linkedin && data.website && <ContactRow icon={Globe} label="Website" href={data.website} />}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Leave message here and check in notification"
        className="w-full resize-none rounded-[20px] bg-white px-5 py-5 min-h-[140px] shadow-[0_2px_10px_rgba(0,0,0,0.04)] border-none text-[16px] text-[#222] mb-6 focus:outline-none focus:ring-2 focus:ring-[#DF541D] placeholder-[#888]"
      ></textarea>

      <a
        href={mailtoHref}
        className="block w-full rounded-[16px] bg-[#DF541D] text-white font-semibold text-[1.35rem] py-[14px] text-center transition-transform active:scale-[0.98] hover:bg-[#C94A18]"
      >
        Send Message
      </a>
    </div>
  );
}
