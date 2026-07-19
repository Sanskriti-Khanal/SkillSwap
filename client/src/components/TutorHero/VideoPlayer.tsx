import { useState } from 'react';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';

interface VideoPlayerProps {
  youtubeUrl?: string;
  thumbnailUrl?: string;
}

// Lazy-loaded YouTube embed: only mounts the iframe once the user presses play.
export default function VideoPlayer({ youtubeUrl, thumbnailUrl }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative aspect-video w-full max-w-md overflow-hidden rounded-2xl bg-black shadow-lg"
    >
      {playing ? (
        <iframe
          src={`https://www.youtube.com/embed/${youtubeUrl?.match(/(?:youtu\.be\/|v=)([\w-]{6,})/)?.[1]}?autoplay=1`}
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
          {thumbnailUrl && (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-60" />
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F97316] text-white shadow-xl transition-transform group-hover:scale-110">
              <Play size={26} fill="white" className="ml-1" />
            </span>
          </span>
        </button>
      )}
    </motion.div>
  );
}
