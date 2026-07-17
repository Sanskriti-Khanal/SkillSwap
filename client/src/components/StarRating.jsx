import { Star } from 'lucide-react';

export default function StarRating({ rating, max = 5, size = 15 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} role="img" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          width={size}
          height={size}
          strokeWidth={1.75}
          color="var(--orange)"
          fill={i < rating ? 'var(--orange)' : 'none'}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
