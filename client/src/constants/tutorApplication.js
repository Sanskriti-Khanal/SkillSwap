// Mirrors the enums defined in the server-side models (server/src/models/Tutor*.js).
export const WIZARD_STEPS = [
  { key: 'personal-info', label: 'Personal Info' },
  { key: 'verification', label: 'Identity' },
  { key: 'education', label: 'Education' },
  { key: 'teaching-profile', label: 'Teaching Profile' },
  { key: 'experience', label: 'Experience' },
  { key: 'teaching-proof', label: 'Teaching Proof' },
  { key: 'verification-questions', label: 'Questions' },
  { key: 'agreement', label: 'Agreement' },
];

export const GOVERNMENT_ID_TYPES = [
  { value: 'citizenship', label: 'Citizenship' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'national_id', label: 'National ID' },
];

export const EDUCATION_LEVELS = [
  { value: 'high_school', label: 'High School' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'bachelors', label: "Bachelor's" },
  { value: 'masters', label: "Master's" },
  { value: 'phd', label: 'PhD' },
  { value: 'other', label: 'Other' },
];

export const SKILL_CATEGORIES = [
  { value: 'programming', label: 'Programming' },
  { value: 'design', label: 'Design' },
  { value: 'music', label: 'Music' },
  { value: 'photography', label: 'Photography' },
  { value: 'language', label: 'Language' },
  { value: 'business', label: 'Business' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'art', label: 'Art' },
  { value: 'academic_subjects', label: 'Academic Subjects' },
  { value: 'technology', label: 'Technology' },
  { value: 'other', label: 'Other' },
];

export const TEACHING_LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'];

export const TEACHING_MODES = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'both', label: 'Both' },
];

export const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'student', label: 'Student' },
];

export const CURRENCIES = ['NPR', 'USD', 'EUR', 'INR', 'GBP'];

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_review: 'Pending Review',
  under_review: 'Under Review',
  needs_more_info: 'Needs More Information',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export const STATUS_BADGE = {
  draft: 'badge-neutral',
  submitted: 'badge-orange',
  pending_review: 'badge-orange',
  under_review: 'badge-orange',
  needs_more_info: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
  suspended: 'badge-red',
};
