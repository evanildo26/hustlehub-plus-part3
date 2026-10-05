import { Briefcase, Code, FileText, Megaphone, Music, PenTool, Sparkles, Video } from 'lucide-react';

/** Display metadata for each gig category (label, icon and a short description). */
export const CATEGORY_META = {
  design: { label: 'Design', icon: PenTool, blurb: 'Logos, branding & UI' },
  development: { label: 'Development', icon: Code, blurb: 'Websites, apps & APIs' },
  writing: { label: 'Writing', icon: FileText, blurb: 'Copy, CVs & articles' },
  marketing: { label: 'Marketing', icon: Megaphone, blurb: 'Social, ads & email' },
  video: { label: 'Video', icon: Video, blurb: 'Editing & animation' },
  music: { label: 'Music & Audio', icon: Music, blurb: 'Podcasts & voice-overs' },
  business: { label: 'Business', icon: Briefcase, blurb: 'Plans, books & decks' },
  other: { label: 'Other', icon: Sparkles, blurb: 'Admin, data & more' },
};

export const categoryMeta = (category) => CATEGORY_META[category] || CATEGORY_META.other;
