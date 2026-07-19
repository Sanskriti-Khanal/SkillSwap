import type { ComponentType, SVGProps } from 'react';
import { UserIcon, EnvelopeIcon, AcademicCapIcon, DocumentTextIcon, PlayCircleIcon } from '@heroicons/react/24/solid';

export interface Certification {
  name?: string;
  issuing_organization?: string;
}

export interface PublicProfileResponse {
  user: {
    _id: string;
    email: string;
    role: string;
    profile_photo_url?: string | null;
    bio?: string | null;
    member_since: string;
  };
  profile: {
    display_name?: string;
    professional_headline?: string;
    bio?: string;
    demo_video_youtube_url?: string | null;
    education?: {
      highest_education?: string;
      institution_name?: string;
      field_of_study?: string;
      certifications?: Certification[];
    } | null;
    experience?: {
      portfolio_links?: { website?: string; github?: string; linkedin?: string };
      current_title?: string;
      current_company?: string;
      years_of_professional_experience?: number;
    } | null;
    skills?: {
      primary_category?: string;
      sub_skills?: string[];
      hourly_rate?: number;
      currency?: string;
      teaching_mode?: string;
      teaching_languages?: string[];
      timezone?: string;
    } | null;
  } | null;
}

export interface ReviewItem {
  _id: string;
  rating: number;
  comment: string;
  learner_id?: { email?: string };
  listing_id?: { title?: string };
  createdAt: string;
}

export type SectionKey = 'profile' | 'video' | 'education' | 'contact' | 'resume';

export type Accent = 'orange' | 'green';

export interface IconDef {
  key: SectionKey;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accent: Accent;
}

// Solid (filled) icon glyphs, not outline strokes — matches the flat, colorful
// icon-illustration look the design calls for, colored per ACCENT_HEX below.
export const ICON_DEFS: Record<SectionKey, IconDef> = {
  profile: { key: 'profile', label: 'Meet Your Tutor', icon: UserIcon, accent: 'green' },
  video: { key: 'video', label: 'Demo Video', icon: PlayCircleIcon, accent: 'orange' },
  education: { key: 'education', label: 'Education', icon: AcademicCapIcon, accent: 'orange' },
  contact: { key: 'contact', label: 'Contact Tutor', icon: EnvelopeIcon, accent: 'orange' },
  resume: { key: 'resume', label: 'Curriculum Vitae', icon: DocumentTextIcon, accent: 'green' },
};

export const ACCENT_HEX: Record<Accent, string> = {
  orange: '#F8862F',
  green: '#678D41',
};

export function homeAngle(index: number, total: number): number {
  const step = 360 / total;
  return -90 + step * index;
}

export function toXY(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
}

export interface HeroSections {
  profile: {
    name: string;
    title?: string;
    avatarUrl?: string | null;
    rating?: number;
    reviewCount: number;
    languages?: string[];
    skills: string[];
    bio?: string;
    bookHref: string;
    video: { available: boolean; youtubeUrl?: string; thumbnailUrl?: string };
  };
  education: {
    available: boolean;
    highestEducation?: string;
    institution?: string;
    fieldOfStudy?: string;
    certifications: Certification[];
  };
  contact: { available: boolean; email: string; website?: string; github?: string; linkedin?: string };
  resume: {
    available: boolean;
    about?: string;
    educationLine?: string;
    fieldOfStudy?: string;
    experienceLine?: string;
    skills: string[];
    languages: string[];
    certifications: Certification[];
  };
}

// Extracts a YouTube video ID from any common URL shape (watch?v=, youtu.be/, embed/).
export function extractYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/);
  return match ? match[1] : null;
}

export function buildHeroSections(data: PublicProfileResponse, reviews: ReviewItem[]): HeroSections {
  const { user, profile } = data;
  const name = profile?.display_name || user.email.split('@')[0];
  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : undefined;
  const links = profile?.experience?.portfolio_links || {};
  const youtubeId = extractYouTubeId(profile?.demo_video_youtube_url);

  const educationAvailable = Boolean(
    profile?.education?.highest_education || profile?.education?.institution_name || (profile?.education?.certifications?.length ?? 0) > 0
  );
  const resumeAvailable = Boolean(profile && (profile.bio || profile.education || profile.experience || profile.skills));

  return {
    profile: {
      name,
      title: profile?.professional_headline,
      avatarUrl: user.profile_photo_url ? (
        user.profile_photo_url.startsWith('http') || user.profile_photo_url.startsWith('data:') || user.profile_photo_url.startsWith('/')
          ? user.profile_photo_url 
          : `/${user.profile_photo_url}`
      ) : null,
      rating: avgRating,
      reviewCount: reviews.length,
      languages: profile?.skills?.teaching_languages,
      skills: profile?.skills?.sub_skills || [],
      bio: profile?.bio || user.bio || undefined,
      bookHref: '#tutor-listings',
      video: {
        available: Boolean(youtubeId),
        youtubeUrl: profile?.demo_video_youtube_url || undefined,
        thumbnailUrl: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : undefined,
      },
    },
    education: {
      available: educationAvailable,
      highestEducation: profile?.education?.highest_education,
      institution: profile?.education?.institution_name,
      fieldOfStudy: profile?.education?.field_of_study,
      certifications: profile?.education?.certifications || [],
    },
    contact: {
      available: true, // email is always present
      email: user.email,
      website: links.website,
      github: links.github,
      linkedin: links.linkedin,
    },
    resume: {
      available: resumeAvailable,
      about: profile?.bio || user.bio || undefined,
      educationLine: profile?.education?.highest_education,
      fieldOfStudy: profile?.education?.field_of_study,
      experienceLine: profile?.experience?.current_title
        ? `${profile.experience.current_title}${profile.experience.current_company ? ` at ${profile.experience.current_company}` : ''}`
        : undefined,
      skills: profile?.skills?.sub_skills || [],
      languages: profile?.skills?.teaching_languages || [],
      certifications: profile?.education?.certifications || [],
    },
  };
}

export function availableSectionKeys(sections: HeroSections): SectionKey[] {
  const keys: SectionKey[] = ['profile'];
  if (sections.profile.video.available) keys.push('video');
  if (sections.education.available) keys.push('education');
  if (sections.contact.available) keys.push('contact');
  if (sections.resume.available) keys.push('resume');
  return keys;
}
