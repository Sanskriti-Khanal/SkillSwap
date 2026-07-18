import { AnimatePresence, motion } from 'framer-motion';
import type { HeroSections, SectionKey } from './data';
import ProfileCard from './ProfileCard';
import VideoCard from './VideoCard';
import ContactCard from './ContactCard';
import ExperienceCard from './ExperienceCard';
import ResumeCard from './ResumeCard';

interface DynamicContentProps {
  activeKey: SectionKey;
  sections: HeroSections;
}

export default function DynamicContent({ activeKey, sections }: DynamicContentProps) {
  return (
    <div aria-live="polite" className="relative min-h-[380px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeKey}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          {activeKey === 'profile' && <ProfileCard data={sections.profile} />}
          {activeKey === 'video' && <VideoCard data={sections.video} />}
          {activeKey === 'contact' && <ContactCard data={sections.contact} />}
          {activeKey === 'experience' && <ExperienceCard data={sections.experience} />}
          {activeKey === 'resume' && <ResumeCard data={sections.resume} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
