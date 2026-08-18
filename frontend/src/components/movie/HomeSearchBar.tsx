import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, X, Star } from "lucide-react";
import { movieService, actorService, directorService } from "@/services";
import type { MovieListItem, ActorListItem, DirectorListItem } from "@/types";
import "./HomeSearchBar.css";

const DEBOUNCE_MS = 320;
const MAX_MOVIES = 4;
const MAX_ACTORS = 2;
const MAX_DIRECTORS = 2;

export default function HomeSearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [actors, setActors] = useState<ActorListItem[]>([]);
  const [directors, setDirectors] = useState<DirectorListItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setMovies([]);
      setActors([]);
      setDirectors([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [movieRes, actorRes, directorRes] = await Promise.all([
          movieService.search({ title: query, page: 1, pageSize: MAX_MOVIES }),
          actorService.search(query, 1, MAX_ACTORS),
          directorService.search(query, 1, MAX_DIRECTORS),
        ]);
        setMovies(movieRes.items);
        setActors(actorRes.items);
        setDirectors(directorRes.items);
      } catch {
        setMovies([]);
        setActors([]);
        setDirectors([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goToFullSearch = () => {
    if (!query.trim()) return;
    navigate(`/search?title=${encodeURIComponent(query.trim())}`);
    setIsOpen(false);
  };

  const goToMovie = (id: string) => {
    navigate(`/movies/${id}`);
    setQuery("");
    setIsOpen(false);
  };

  const goToActor = (id: string) => {
    navigate(`/actors/${id}`);
    setQuery("");
    setIsOpen(false);
  };

  const goToDirector = (id: string) => {
    navigate(`/directors/${id}`);
    setQuery("");
    setIsOpen(false);
  };

  const hasResults =
    movies.length > 0 || actors.length > 0 || directors.length > 0;

  return (
    <section className="home-search">
      <div className="container home-search__container">
        <div className="home-search__box" ref={containerRef}>
          <Search size={18} className="home-search__icon" />
          <input
            type="text"
            className="home-search__input"
            placeholder={t("home.searchPlaceholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToFullSearch();
            }}
          />
          {query && (
            <button
              className="home-search__clear"
              onClick={() => {
                setQuery("");
                setMovies([]);
                setActors([]);
                setDirectors([]);
              }}
              aria-label={t("common.clear")}
            >
              <X size={15} />
            </button>
          )}

          {isOpen && query.trim().length >= 2 && (
            <div className="home-search__dropdown">
              {isSearching && (
                <div className="home-search__status">{t("common.loading")}</div>
              )}

              {!isSearching && !hasResults && (
                <div className="home-search__status">
                  {t("search.noResults")}
                </div>
              )}

              {!isSearching && movies.length > 0 && (
                <div className="home-search__group">
                  <p className="home-search__group-label">
                    {t("home.searchMovies")}
                  </p>
                  {movies.map((movie) => (
                    <button
                      key={movie.id}
                      className="home-search__result"
                      onClick={() => goToMovie(movie.id)}
                    >
                      <img
                        src={movie.posterUrl}
                        alt=""
                        className="home-search__result-poster"
                        loading="lazy"
                      />
                      <div className="home-search__result-info">
                        <p className="home-search__result-title">
                          {movie.title}
                        </p>
                        <p className="home-search__result-meta">
                          <Star size={11} fill="currentColor" />{" "}
                          {movie.averageRating.toFixed(1)}
                          <span className="home-search__result-year">
                            {movie.releaseYear}
                          </span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isSearching && actors.length > 0 && (
                <div className="home-search__group">
                  <p className="home-search__group-label">
                    {t("home.searchActors")}
                  </p>
                  {actors.map((actor) => (
                    <button
                      key={actor.id}
                      className="home-search__result"
                      onClick={() => goToActor(actor.id)}
                    >
                      <img
                        src={actor.photoUrl}
                        alt=""
                        className="home-search__result-avatar"
                        loading="lazy"
                      />
                      <div className="home-search__result-info">
                        <p className="home-search__result-title">
                          {actor.fullName}
                        </p>
                        {actor.nationality && (
                          <p className="home-search__result-meta">
                            {actor.nationality}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isSearching && directors.length > 0 && (
                <div className="home-search__group">
                  <p className="home-search__group-label">
                    {t("home.searchDirectors")}
                  </p>
                  {directors.map((director) => (
                    <button
                      key={director.id}
                      className="home-search__result"
                      onClick={() => goToDirector(director.id)}
                    >
                      <img
                        src={director.photoUrl}
                        alt=""
                        className="home-search__result-avatar"
                        loading="lazy"
                      />
                      <div className="home-search__result-info">
                        <p className="home-search__result-title">
                          {director.fullName}
                        </p>
                        {director.nationality && (
                          <p className="home-search__result-meta">
                            {director.nationality}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isSearching && movies.length > 0 && (
                <button
                  className="home-search__see-all"
                  onClick={goToFullSearch}
                >
                  {t("home.searchSeeAll", { query })}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
