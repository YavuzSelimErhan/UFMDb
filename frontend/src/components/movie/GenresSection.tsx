import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import type { Genre } from '@/types';
import './GenresSection.css';

interface Props {
  genres: Genre[];
}

interface GenreVisual {
  icon: string;
  color: string;
  dark: string;
}

// Görsel kimlik (ikon/renk) sadece sunum amaçlıdır, DB'den gelmez — TMDB'nin standart tür isimleriyle eşleşir.
const GENRE_VISUALS: Record<string, GenreVisual> = {
  Action: { icon: '⚡', color: '#e84118', dark: '#1a0800' },
  Adventure: { icon: '🧭', color: '#2ecc71', dark: '#04160c' },
  Animation: { icon: '🎨', color: '#00cec9', dark: '#001a1a' },
  Comedy: { icon: '😂', color: '#f9ca24', dark: '#1a1500' },
  Crime: { icon: '🔫', color: '#6c5ce7', dark: '#0a0514' },
  Documentary: { icon: '🎥', color: '#7f8c8d', dark: '#101314' },
  Drama: { icon: '🎭', color: '#4a90e2', dark: '#050d1a' },
  Family: { icon: '👨‍👩‍👧', color: '#ff9f43', dark: '#1a1006' },
  Fantasy: { icon: '🐉', color: '#a29bfe', dark: '#06041a' },
  History: { icon: '🏛️', color: '#b8860b', dark: '#100a00' },
  Horror: { icon: '💀', color: '#2d3436', dark: '#010403' },
  Music: { icon: '🎵', color: '#e84393', dark: '#1a0010' },
  Mystery: { icon: '🕵️', color: '#8e44ad', dark: '#0f0614' },
  Romance: { icon: '💋', color: '#fd79a8', dark: '#1a0010' },
  'Sci-Fi': { icon: '🚀', color: '#00b894', dark: '#001a12' },
  Thriller: { icon: '🔪', color: '#fdcb6e', dark: '#1a1000' },
  'TV Movie': { icon: '📺', color: '#34495e', dark: '#080d12' },
  War: { icon: '🪖', color: '#5a4a2a', dark: '#120e08' },
  Western: { icon: '🤠', color: '#e17055', dark: '#1a0800' }
};

const DEFAULT_VISUAL: GenreVisual = { icon: '🎬', color: '#4a90e2', dark: '#050d1a' };

/** Film sayısına göre kartın grid'deki boyutunu belirler (gerçek veriye dayalı bento efekti). */
function sizeForRank(rank: number): 'large' | 'wide' | 'medium' {
  if (rank === 0) return 'large';
  if (rank <= 3) return 'wide';
  return 'medium';
}

export default function GenresSection({ genres }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  if (genres.length === 0) return null;

  const sorted = [...genres].sort((a, b) => b.movieCount - a.movieCount);

  return (
    <section className="genres-section">
      <div className="genres-section__header">
        <div className="genres-section__label-wrap">
          <p className="genres-section__eyebrow">{t('home.genresEyebrow')}</p>
          <h2 className="genres-section__title">{t('home.genresTitle')}</h2>
        </div>
        <span className="genres-section__count-pill">{genres.length} {t('home.genresCountSuffix')}</span>
      </div>

      <div className="genres-section__grid">
        {sorted.map((genre, i) => {
          const visual = GENRE_VISUALS[genre.name] ?? DEFAULT_VISUAL;
          const size = sizeForRank(i);
          const displayName = i18n.language === 'tr' ? genre.nameTr : genre.name;

          return (
            <button
              key={genre.id}
              className={`genre-card genre-card--${size}`}
              style={{
                '--genre-color': visual.color,
                '--genre-dark': visual.dark
              } as React.CSSProperties}
              onClick={() => navigate(`/search?genre=${encodeURIComponent(displayName)}`)}
              aria-label={`${displayName} — ${genre.movieCount} ${t('search.titlesCount')}`}
            >
              <div className="genre-card__base" aria-hidden="true" />
              <div className="genre-card__flood" aria-hidden="true" />
              <div className="genre-card__content">
                <div className="genre-card__icon">{visual.icon}</div>
                <div className="genre-card__bottom">
                  <h3 className="genre-card__name">{displayName}</h3>
                  <div className="genre-card__meta">
                    <span className="genre-card__count">{genre.movieCount} {t('search.titlesCount').toUpperCase()}</span>
                    <span className="genre-card__arrow"><ArrowRight size={13} /></span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
