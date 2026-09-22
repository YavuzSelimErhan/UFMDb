import type { MovieListItem } from '@/types';
import MovieCard from '@/components/movie/MovieCard';
import { useScreeningLogModal } from '@/hooks/useScreeningLogModal';
import './MovieRow.css';

interface Props {
  title: string;
  movies: MovieListItem[];
}

export default function MovieRow({ title, movies }: Props) {
  const { openLog, logModal } = useScreeningLogModal();

  if (movies.length === 0) return null;

  return (
    <section className="movie-row">
      <h2 className="movie-row__title">{title}</h2>
      <div className="movie-row__scroll">
        {movies.map((m) => (
          <div key={m.id} className="movie-row__item">
            <MovieCard movie={m} onLogClick={() => openLog(m)} />
          </div>
        ))}
      </div>
      {logModal}
    </section>
  );
}
