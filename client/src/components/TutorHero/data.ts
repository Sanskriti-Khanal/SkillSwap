import type { ComponentType } from 'react';
import { User, Monitor, Mail, GraduationCap, FileText } from 'lucide-react';

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

export type SectionKey = 'profile' | 'video' | 'contact' | 'experience' | 'resume';

export type Accent = 'orange' | 'green';

export interface IconDef {
  key: SectionKey;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  accent: Accent;
}

export const ICON_DEFS: Record<SectionKey, IconDef> = {
  profile: { key: 'profile', label: 'Meet Your Tutor', icon: User, accent: 'green' },
  video: { key: 'video', label: 'Watch Demo Class', icon: Monitor, accent: 'orange' },
  contact: { key: 'contact', label: 'Contact Tutor', icon: Mail, accent: 'orange' },
  experience: { key: 'experience', label: 'Experience & Skills', icon: GraduationCap, accent: 'orange' },
  resume: { key: 'resume', label: 'Curriculum Vitae', icon: FileText, accent: 'green' },
};

export const ACCENT_HEX: Record<Accent, string> = {
  orange: '#F8862F',
  green: '#678D41',
};

// Fixed "home" angle per icon, evenly spaced around the full circle starting at
// 12 o'clock — stable regardless of which one is currently active, so an inactive
// icon always returns to the exact same spot.
export function homeAngle(index: number, total: number): number {
  return -90 + (360 / total) * index;
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
    bio?: string;
    bookHref: string;
  };
  video: { available: boolean; youtubeUrl?: string; thumbnailUrl?: string; headline?: string };
  contact: { available: boolean; email: string; website?: string; github?: string; linkedin?: string };
  experience: {
    available: boolean;
    currentTitle?: string;
    currentCompany?: string;
    yearsExperience?: number;
    skills: string[];
    certifications: Certification[];
  };
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

  const experienceAvailable = Boolean(
    profile?.experience?.current_title || (profile?.skills?.sub_skills?.length ?? 0) > 0 || (profile?.education?.certifications?.length ?? 0) > 0
  );
  const resumeAvailable = Boolean(profile && (profile.bio || profile.education || profile.experience || profile.skills));

  return {
    profile: {
      name,
      title: profile?.professional_headline,
      avatarUrl: user.profile_photo_url,
      rating: avgRating,
      reviewCount: reviews.length,
      languages: profile?.skills?.teaching_languages,
      bio: profile?.bio || user.bio || undefined,
      bookHref: '#tutor-listings',
    },
    video: {
      available: Boolean(youtubeId),
      youtubeUrl: profile?.demo_video_youtube_url || undefined,
      thumbnailUrl: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : undefined,
      headline: profile?.professional_headline,
    },
    contact: {
      available: true, // email is always present
      email: user.email,
      website: links.website,
      github: links.github,
      linkedin: links.linkedin,
    },
    experience: {
      available: experienceAvailable,
      currentTitle: profile?.experience?.current_title,
      currentCompany: profile?.experience?.current_company,
      yearsExperience: profile?.experience?.years_of_professional_experience,
      skills: profile?.skills?.sub_skills || [],
      certifications: profile?.education?.certifications || [],
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

// Which icons actually have real content to show, in spec order.
export function availableSectionKeys(sections: HeroSections): SectionKey[] {
  const keys: SectionKey[] = ['profile'];
  if (sections.video.available) keys.push('video');
  if (sections.contact.available) keys.push('contact');
  if (sections.experience.available) keys.push('experience');
  if (sections.resume.available) keys.push('resume');
  return keys;
}
