import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, Film, Users } from "lucide-react";
import FavoriteSlotPicker from "./FavoriteSlotPicker";
import FavoriteActorSlotPicker from "./FavoriteActorSlotPicker";
import FavoriteDirectorSlotPicker from "./FavoriteDirectorSlotPicker";
import type {
  FavoriteSlot,
  FavoriteActorSlot,
  FavoriteDirectorSlot,
} from "@/types";
import "./FavoritesShowcase.css";

interface Props {
  movies: FavoriteSlot[];
  actors: FavoriteActorSlot[];
  directors: FavoriteDirectorSlot[];
  isOwnProfile: boolean;
}

type FavTab = "movies" | "actors" | "directors";

const THEME: Record<
  FavTab,
  { accent: string; dim: string; glow: string; icon: typeof Film }
> = {
  movies: {
    accent: "#d4af37",
    dim: "rgba(212,175,55,0.14)",
    glow: "rgba(212,175,55,0.35)",
    icon: Film,
  },
  actors: {
    accent: "#4a90e2",
    dim: "rgba(74,144,226,0.14)",
    glow: "rgba(74,144,226,0.30)",
    icon: Users,
  },
  directors: {
    accent: "#00ff88",
    dim: "rgba(0,255,136,0.12)",
    glow: "rgba(0,255,136,0.35)",
    icon: Clapperboard,
  },
};

export default function FavoritesShowcase({
  movies,
  actors,
  directors,
  isOwnProfile,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FavTab>("movies");
  const theme = THEME[tab];

  return (
    <section
      className="fav-showcase"
      style={
        {
          "--fav-accent": theme.accent,
          "--fav-accent-dim": theme.dim,
          "--fav-glow": theme.glow,
        } as React.CSSProperties
      }
    >
      <div className="fav-showcase__header">
        <div className="fav-showcase__label-wrap">
          <p className="fav-showcase__eyebrow">
            {t(
              isOwnProfile
                ? "profile.showcaseEyebrow"
                : "profile.showcaseEyebrowOther",
            )}
          </p>
          <h2 className="fav-showcase__title">
            {t(
              isOwnProfile
                ? "profile.showcaseTitle"
                : "profile.showcaseTitleOther",
            )}
          </h2>
        </div>

        <div className="fav-showcase__tabs">
          {(["movies", "actors", "directors"] as FavTab[]).map((key) => {
            const Icon = THEME[key].icon;
            return (
              <button
                key={key}
                className={`fav-showcase__tab ${tab === key ? "is-active" : ""}`}
                style={
                  tab === key
                    ? {
                        background: `linear-gradient(135deg, ${THEME[key].accent}, ${THEME[key].accent}cc)`,
                      }
                    : undefined
                }
                onClick={() => setTab(key)}
              >
                <Icon size={14} />{" "}
                {t(
                  `profile.favorite${key.charAt(0).toUpperCase() + key.slice(1)}Tab`,
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fav-showcase__panel">
        {tab === "movies" && (
          <FavoriteSlotPicker slots={movies} isOwnProfile={isOwnProfile} />
        )}
        {tab === "actors" && (
          <FavoriteActorSlotPicker slots={actors} isOwnProfile={isOwnProfile} />
        )}
        {tab === "directors" && (
          <FavoriteDirectorSlotPicker
            slots={directors}
            isOwnProfile={isOwnProfile}
          />
        )}
      </div>
    </section>
  );
}
