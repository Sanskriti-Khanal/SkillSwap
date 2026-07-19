import VideoPlayer from './VideoPlayer';
import type { HeroSections } from './data';

export default function VideoCard({ data }: { data: HeroSections['profile']['video'] }) {
  if (!data.available) return null;

  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1E1E1E] mb-1">Demo Video</h2>
      <p className="text-[#666] mb-6">Watch this tutor's introduction and teaching style.</p>
      
      <div className="max-w-xl">
        <VideoPlayer youtubeUrl={data.youtubeUrl} thumbnailUrl={data.thumbnailUrl} />
      </div>
    </div>
  );
}
