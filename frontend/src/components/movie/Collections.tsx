import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Layers } from "lucide-react";
import type { ListSummary } from "@/types";
import { getListTheme } from "@/utils/listTheme";
import "./Collections.css";

interface Props {
  lists: ListSummary[];
}

const MAX_COLLECTIONS = 10;

export default function Collections({ lists }: Props) {
  const { t, i18n } = useTranslation();

  if (!lists || lists.length === 0) return null;

  const preview = lists.slice(0, MAX_COLLECTIONS);

  return (
    <section className="collections-section">
      <div className="collections-section__header">
        <div className="collections-section__label-wrap">
          <p className="collections-section__eyebrow">
            {t("home.collectionsEyebrow")}
          </p>
          <h2 className="collections-section__title">
            {t("home.collections")}
          </h2>
        </div>
        <Link to="/lists" className="collections-section__see-all">
          {t("home.viewAllLists")} <ArrowRight size={12} />
        </Link>
      </div>

      <div className="collections-grid">
        {preview.map((list) => {
          const displayTitle =
            i18n.language === "tr" ? list.titleTr : list.title;
          const theme = getListTheme(list.id);
          const cover = list.coverImageUrl || list.coverPosters?.[0];

          return (
            <Link
              key={list.id}
              to={`/lists/${list.id}`}
              className="collection-card"
              style={{ "--cc-color": theme.accent } as React.CSSProperties}
            >
              <div className="collection-card__media">
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    className="collection-card__cover"
                  />
                ) : (
                  <div className="collection-card__placeholder">
                    <Layers size={22} />
                  </div>
                )}
                <div className="collection-card__scrim" />
                <span className="collection-card__count">
                  {list.movieCount} {t("lists.moviesCount")}
                </span>
              </div>
              <div className="collection-card__foot">
                <p className="collection-card__title">{displayTitle}</p>
                <span className="collection-card__arrow">
                  <ArrowRight size={10} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
