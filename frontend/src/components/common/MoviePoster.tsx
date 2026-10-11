import { useState } from "react";
import { Link } from "react-router-dom";
import { Film } from "lucide-react";
import "./MoviePoster.css";

interface MoviePosterProps {
  movie: { id: string | number; title: string; posterUrl?: string | null };
  /** Dış sarmalayıcının (Link) boyut/kenarlık sınıfı; sayfa CSS'i belirler. */
  className: string;
  /** Poster yoksa/bozuksa: yalnızca ikon ya da ikon + film adı. */
  fallback?: "icon" | "title";
  iconSize?: number;
}

/**
 * Poster görseli + hata/eksik durumunda yedek. İki sayfadaki `Poster` kopyalarının yerine.
 *
 * Link bilinçli olarak dekoratif (aria-hidden, tabIndex -1): aynı hedefe giden başlık
 * linki her zaman var; klavye ve ekran okuyucu için tekrar durak oluşturmuyor.
 */
export default function MoviePoster({
  movie,
  className,
  fallback = "icon",
  iconSize = 20,
}: MoviePosterProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !movie.posterUrl || failed;

  return (
    <Link
      to={`/movies/${movie.id}`}
      className={className}
      tabIndex={-1}
      aria-hidden="true"
    >
      {showFallback ? (
        <span className="movie-poster__fallback">
          <Film size={iconSize} />
          {fallback === "title" && <span>{movie.title}</span>}
        </span>
      ) : (
        <img
          className="movie-poster__img"
          src={movie.posterUrl ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </Link>
  );
}
