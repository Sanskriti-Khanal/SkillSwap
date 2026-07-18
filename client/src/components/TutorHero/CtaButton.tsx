import type { ReactNode } from 'react';

interface CtaButtonProps {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
}

const CTA_CLASSNAME =
  'inline-flex items-center gap-2 rounded-[40px] bg-[#F8862F] px-10 py-4 text-[16px] font-semibold uppercase tracking-widest text-white shadow-[0_10px_25px_-5px_rgba(248,134,47,0.6)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_30px_-5px_rgba(248,134,47,0.7)] focus-visible:outline-none';

// Shared pill-shaped gradient CTA, reused across every Hero card for a consistent action style.
export default function CtaButton({ href, onClick, children, icon }: CtaButtonProps) {
  if (href) {
    return (
      <a href={href} className={CTA_CLASSNAME}>
        {icon}
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={CTA_CLASSNAME}>
      {icon}
      {children}
    </button>
  );
}
