import type { MovieListItem } from '@/types';
import MovieCard from '@/components/movie/MovieCard';
import './MovieRow.css';

interface Props {
  title: string;
  movies: MovieListItem[];
}

export default function MovieRow({ title, movies }: Props) {
  if (movies.length === 0) return null;

  return (
    <section className="movie-row">
      <h2 className="movie-row__title">{title}</h2>
      <div className="movie-row__scroll">
        {movies.map((m) => (
          <div key={m.id} className="movie-row__item">
            <MovieCard movie={m} />
          </div>
        ))}
      </div>
    </section>
  );
}
