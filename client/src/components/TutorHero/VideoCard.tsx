import { useState } from 'react';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import type { HeroSections } from './data';

export default function VideoCard({ data }: { data: HeroSections['video'] }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div>
      <h2 className="text-3xl font-bold text-[#1E1E1E] mb-1">Watch Demo Class</h2>
      {data.headline && <p className="text-[#666] mb-6">{data.headline}</p>}

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative aspect-video w-full max-w-md overflow-hidden rounded-2xl bg-black shadow-lg"
      >
        {playing ? (
          // Lazy: iframe only mounts once the user actually presses play.
          <iframe
            src={`https://www.youtube.com/embed/${data.youtubeUrl?.match(/(?:youtu\.be\/|v=)([\w-]{6,})/)?.[1]}?autoplay=1`}
            title="Teaching demo video"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative h-full w-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
            aria-label="Play teaching demo video"
          >
            {data.thumbnailUrl && (
              <img src={data.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-60" />
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F97316] text-white shadow-xl transition-transform group-hover:scale-110">
                <Play size={26} fill="white" className="ml-1" />
              </span>
            </span>
          </button>
        )}
      </motion.div>
    </div>
  );
}
