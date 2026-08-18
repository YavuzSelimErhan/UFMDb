import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MovieListItem } from '@/types';
import MovieCard from '@/components/movie/MovieCard';
import type { RailTheme } from '@/components/movie/ThemedMovieRail';
import './CuratedSection.css';

const THEME_COLORS: Record<RailTheme, { accent: string; dim: string }> = {
  gold: { accent: '#d4af37', dim: 'rgba(212,175,55,0.14)' },
  neon: { accent: '#00ff88', dim: 'rgba(0,255,136,0.12)' },
  teal: { accent: '#1a9e8f', dim: 'rgba(26,158,143,0.14)' },
  crimson: { accent: '#c0392b', dim: 'rgba(192,57,43,0.14)' },
  frost: { accent: '#4a90e2', dim: 'rgba(74,144,226,0.14)' }
};

interface Props {
  title: string;
  titleTr?: string;
  movies: MovieListItem[];
  theme?: RailTheme;
}

/** Küratör seçkileri, diğer film şeritlerinden ayrışsın diye vurgulu bir panel içinde gösterilir. */
export default function CuratedSection({ title, titleTr, movies, theme = 'frost' }: Props) {
  const { t, i18n } = useTranslation();
  if (movies.length === 0) return null;

  const displayTitle = i18n.language === 'tr' && titleTr ? titleTr : title;
  const colors = THEME_COLORS[theme];

  return (
    <section
      className="curated-section"
      style={{ '--curated-accent': colors.accent, '--curated-accent-dim': colors.dim } as React.CSSProperties}
    >
      <div className="curated-section__header">
        <span className="curated-section__badge">
          <Sparkles size={13} /> {t('home.curatedBadge')}
        </span>
        <h2>{displayTitle}</h2>
      </div>
      <div className="curated-section__grid">
        {movies.map((m) => <MovieCard key={m.id} movie={m} />)}
      </div>
    </section>
  );
}
