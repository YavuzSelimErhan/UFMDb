import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ExternalLink, Play, X } from "lucide-react";
import type {
  MovieCollection,
  MovieDetail,
  MovieImage,
  MovieVideo,
} from "@/types";
import "./MovieExtraSections.css";

const TMDB_IMG = "https://image.tmdb.org/t/p/";
const YT_KEY = /^[\w-]{6,20}$/;
const VISIBLE_FRAMES = 8;

/**
 * Anahtar kelime etiketleri şimdilik tıklanamaz. Arama sayfası `keyword` parametresini
 * okuyacak hale gelince buraya örn. "/search?keyword=" yazın; etiketler link olur.
 */
const KEYWORD_LINK_BASE: string | null = null;

/** Film detay rotası (koleksiyondaki diğer filmlere link için). */
const MOVIE_ROUTE_BASE = "/movies/";

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mx-heading">
      <span className="mx-heading__eyebrow">{eyebrow}</span>
      <h3 className="mx-heading__title">{title}</h3>
    </div>
  );
}

function formatUsd(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
}

function displayLanguage(code: string, locale: string): string {
  if (!code) return "";
  try {
    return (
      new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

// ---------------------------------------------------------------------------
// 1) Gösterim Odası: fragmanlar (YouTube, tıklayınca yüklenir)
// ---------------------------------------------------------------------------

function ScreeningRoom({
  videos,
  printCode,
}: {
  videos: MovieVideo[];
  printCode: string;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = videos[active];
  if (!current) return null;

  const typeLabel = (v: MovieVideo) =>
    t(`movie.extras.videoTypes.${v.type}`, { defaultValue: v.type });

  const select = (i: number) => {
    setActive(i);
    setPlaying(true);
  };

  return (
    <section
      className="mx-section"
      aria-label={t("movie.extras.screeningRoom")}
    >
      <SectionHeading
        eyebrow={`REEL ${printCode}`}
        title={t("movie.extras.screeningRoom")}
      />

      <div className="mx-room__reel">
        <div className="mx-room__sprockets" aria-hidden="true" />
        <div className="mx-room__frame">
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${current.key}?autoplay=1&rel=0`}
              title={current.name || typeLabel(current)}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              className="mx-room__poster"
              style={{
                backgroundImage: `url(https://i.ytimg.com/vi/${current.key}/hqdefault.jpg)`,
              }}
              onClick={() => setPlaying(true)}
              aria-label={t("movie.extras.playTrailer")}
            >
              <span className="mx-room__play">
                <Play size={26} fill="currentColor" />
              </span>
            </button>
          )}
        </div>
        <div className="mx-room__sprockets" aria-hidden="true" />
      </div>

      {videos.length > 1 && (
        <div className="mx-room__list">
          {videos.map((v, i) => (
            <button
              key={`${v.key}-${i}`}
              type="button"
              className={`mx-chip${i === active ? " is-active" : ""}`}
              onClick={() => select(i)}
              title={v.name || undefined}
            >
              {typeLabel(v)}
              {v.language ? ` · ${v.language.toUpperCase()}` : ""}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2) Kontak Sayfası: kareler + afişler, tam ekran görüntüleyici
// ---------------------------------------------------------------------------

function Lightbox({
  items,
  index,
  isPoster,
  onClose,
  onChange,
}: {
  items: MovieImage[];
  index: number;
  isPoster: boolean;
  onClose: () => void;
  onChange: (next: number) => void;
}) {
  const { t } = useTranslation();
  const total = items.length;
  const prev = () => onChange((index - 1 + total) % total);
  const next = () => onChange((index + 1) % total);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  });

  const item = items[index];
  if (!item) return null;

  return createPortal(
    <div
      className="mx-lightbox"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <img
        className="mx-lightbox__img"
        src={`${TMDB_IMG}${isPoster ? "w780" : "w1280"}${item.filePath}`}
        alt=""
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className="mx-lightbox__btn mx-lightbox__btn--close"
        onClick={onClose}
        aria-label={t("movie.extras.closeViewer")}
      >
        <X size={20} />
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            className="mx-lightbox__btn mx-lightbox__btn--prev"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label={t("common.previous")}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            className="mx-lightbox__btn mx-lightbox__btn--next"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label={t("common.next")}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}
      <span className="mx-lightbox__meta">
        {index + 1} / {total}
      </span>
    </div>,
    document.body,
  );
}

function ContactSheet({
  images,
  printCode,
  lang,
}: {
  images: MovieImage[];
  printCode: string;
  lang: string;
}) {
  const { t } = useTranslation();

  const backdrops = useMemo(
    () => images.filter((i) => i.type === "Backdrop"),
    [images],
  );
  const posters = useMemo(() => {
    const rank = (l: string) => (l === lang ? 0 : l === "" ? 1 : 2);
    return images
      .filter((i) => i.type === "Poster")
      .sort((a, b) => rank(a.language) - rank(b.language));
  }, [images, lang]);

  const [tab, setTab] = useState<"Backdrop" | "Poster">(
    backdrops.length > 0 ? "Backdrop" : "Poster",
  );
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (backdrops.length === 0 && posters.length === 0) return null;

  const isPoster = tab === "Poster";
  const list = isPoster ? posters : backdrops;
  const visible = expanded ? list : list.slice(0, VISIBLE_FRAMES);

  const switchTab = (next: "Backdrop" | "Poster") => {
    setTab(next);
    setExpanded(false);
    setLightbox(null);
  };

  return (
    <section className="mx-section" aria-label={t("movie.extras.contactSheet")}>
      <SectionHeading
        eyebrow={`SHEET ${printCode}`}
        title={t("movie.extras.contactSheet")}
      />

      {backdrops.length > 0 && posters.length > 0 && (
        <div className="mx-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "Backdrop"}
            className={`mx-chip${tab === "Backdrop" ? " is-active" : ""}`}
            onClick={() => switchTab("Backdrop")}
          >
            {t("movie.extras.galleryStills")} · {backdrops.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "Poster"}
            className={`mx-chip${tab === "Poster" ? " is-active" : ""}`}
            onClick={() => switchTab("Poster")}
          >
            {t("movie.extras.galleryPosters")} · {posters.length}
          </button>
        </div>
      )}

      <div className={`mx-sheet${isPoster ? " mx-sheet--posters" : ""}`}>
        {visible.map((img, i) => (
          <button
            key={`${img.filePath}-${i}`}
            type="button"
            className="mx-frame"
            onClick={() => setLightbox(i)}
          >
            <img
              src={`${TMDB_IMG}${isPoster ? "w342" : "w780"}${img.filePath}`}
              alt=""
              loading="lazy"
              className={
                isPoster ? "mx-frame__img--poster" : "mx-frame__img--wide"
              }
            />
            <span className="mx-frame__code">
              ▸ {printCode}-{String(i + 1).padStart(2, "0")}
              {isPoster ? "B" : "A"}
            </span>
          </button>
        ))}
      </div>

      {list.length > VISIBLE_FRAMES && (
        <button
          type="button"
          className="mx-more"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? t("common.showLess") : t("common.showMore")}
        </button>
      )}

      {lightbox !== null && (
        <Lightbox
          items={list}
          index={lightbox}
          isPoster={isPoster}
          onClose={() => setLightbox(null)}
          onChange={setLightbox}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3) Yapım Fişi: künye bilgileri + bağlantılar
// ---------------------------------------------------------------------------

function ProductionSlip({
  movie,
  printCode,
  locale,
}: {
  movie: MovieDetail;
  printCode: string;
  locale: string;
}) {
  const { t } = useTranslation();
  const rows: { label: string; value: string }[] = [];

  if (movie.originalTitle && movie.originalTitle !== movie.title)
    rows.push({
      label: t("movie.extras.originalTitle"),
      value: movie.originalTitle,
    });

  const language = displayLanguage(movie.originalLanguage, locale);
  if (language)
    rows.push({ label: t("movie.extras.originalLanguage"), value: language });

  if (movie.tmdbStatus) {
    const key = movie.tmdbStatus.replace(/\s+/g, "");
    rows.push({
      label: t("movie.extras.statusLabel"),
      value: t(`movie.extras.statusValues.${key}`, {
        defaultValue: movie.tmdbStatus,
      }),
    });
  }

  if (movie.budget > 0)
    rows.push({
      label: t("movie.extras.budget"),
      value: formatUsd(movie.budget, locale),
    });
  if (movie.revenue > 0)
    rows.push({
      label: t("movie.extras.revenue"),
      value: formatUsd(movie.revenue, locale),
    });

  const countries = (movie.countries ?? []).map((c) => c.name).join(" · ");
  if (countries)
    rows.push({ label: t("movie.extras.countries"), value: countries });

  const companies = (movie.companies ?? []).map((c) => c.name).join(" · ");
  if (companies)
    rows.push({ label: t("movie.extras.companies"), value: companies });

  const imdbUrl = movie.imdbId
    ? `https://www.imdb.com/title/${encodeURIComponent(movie.imdbId)}/`
    : null;
  const siteUrl =
    movie.homepage && isHttpUrl(movie.homepage) ? movie.homepage : null;

  if (rows.length === 0 && !imdbUrl && !siteUrl) return null;

  return (
    <section
      className="mx-section"
      aria-label={t("movie.extras.productionSlip")}
    >
      <SectionHeading
        eyebrow={`SLIP ${printCode}`}
        title={t("movie.extras.productionSlip")}
      />

      <div className="mx-slip">
        <span
          className="mx-slip__notch mx-slip__notch--left"
          aria-hidden="true"
        />
        <span
          className="mx-slip__notch mx-slip__notch--right"
          aria-hidden="true"
        />

        {rows.map((r) => (
          <div key={r.label} className="mx-slip__row">
            <span className="mx-slip__label">{r.label}</span>
            <span className="mx-slip__leader" aria-hidden="true" />
            <span className="mx-slip__value">{r.value}</span>
          </div>
        ))}

        {(imdbUrl || siteUrl) && (
          <div className="mx-slip__links">
            {imdbUrl && (
              <a
                href={imdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-chip"
              >
                {t("movie.extras.openImdb")} <ExternalLink size={12} />
              </a>
            )}
            {siteUrl && (
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-chip"
              >
                {t("movie.extras.officialSite")} <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        <div className="mx-slip__barcode" aria-hidden="true" />
        <span className="mx-slip__code">*{printCode}*</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4) Etiketler (TMDB anahtar kelimeleri; yalnızca İngilizce gelir)
// ---------------------------------------------------------------------------

function KeywordRail({ movie }: { movie: MovieDetail }) {
  const { t } = useTranslation();
  const keywords = movie.keywords ?? [];
  if (keywords.length === 0) return null;

  return (
    <section className="mx-section" aria-label={t("movie.extras.keywords")}>
      <SectionHeading eyebrow="TAGS" title={t("movie.extras.keywords")} />
      <div className="mx-tags">
        {keywords.map((k) =>
          KEYWORD_LINK_BASE ? (
            <Link
              key={k.id}
              to={`${KEYWORD_LINK_BASE}${encodeURIComponent(k.name)}`}
              className="mx-tag"
            >
              {k.name}
            </Link>
          ) : (
            <span key={k.id} className="mx-tag">
              {k.name}
            </span>
          ),
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5) Seri koçanları: aynı koleksiyondaki diğer filmler
// ---------------------------------------------------------------------------

function CollectionStubs({ collection }: { collection: MovieCollection }) {
  const { t } = useTranslation();
  if (collection.movies.length === 0) return null;

  return (
    <section
      className="mx-section"
      aria-label={t("movie.extras.collectionEyebrow")}
    >
      <SectionHeading
        eyebrow={t("movie.extras.collectionEyebrow")}
        title={t("movie.extras.collectionTitle", { name: collection.name })}
      />
      <div className="mx-stubs">
        {collection.movies.map((m) => (
          <Link
            key={m.id}
            to={`${MOVIE_ROUTE_BASE}${m.id}`}
            className="mx-stub"
          >
            {m.posterUrl ? (
              <img
                src={m.posterUrl}
                alt={m.title}
                loading="lazy"
                className="mx-stub__poster"
              />
            ) : (
              <span className="mx-stub__poster mx-stub__poster--empty" />
            )}
            <span className="mx-stub__tear">
              <span className="mx-stub__title">{m.title}</span>
              <span className="mx-stub__year">{m.releaseYear}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dışa açılan bileşen: film detay sayfasında kadrodan sonra çizilir
// ---------------------------------------------------------------------------

export default function MovieExtraSections({
  movie,
  printCode,
}: {
  movie: MovieDetail;
  printCode: string;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.toLowerCase().startsWith("tr") ? "tr" : "en";
  const locale = lang === "tr" ? "tr-TR" : "en-US";

  const videos = useMemo(() => {
    const list = (movie.videos ?? []).filter(
      (v) => v.site === "YouTube" && YT_KEY.test(v.key),
    );
    if (list.length === 0 && YT_KEY.test(movie.trailerKey ?? "")) {
      list.push({
        key: movie.trailerKey,
        site: "YouTube",
        type: "Trailer",
        name: "",
        language: "",
        isOfficial: false,
      });
    }
    // Önce fragmanlar, sonra arayüz dilindeki videolar; geri kalan sıra korunur.
    return [...list].sort(
      (a, b) =>
        Number(a.type !== "Trailer") - Number(b.type !== "Trailer") ||
        Number(a.language !== lang) - Number(b.language !== lang),
    );
  }, [movie.videos, movie.trailerKey, lang]);

  return (
    <>
      <ScreeningRoom videos={videos} printCode={printCode} />
      <ContactSheet
        images={movie.images ?? []}
        printCode={printCode}
        lang={lang}
      />
      <ProductionSlip movie={movie} printCode={printCode} locale={locale} />
      <KeywordRail movie={movie} />
      {movie.collection && <CollectionStubs collection={movie.collection} />}
    </>
  );
}
