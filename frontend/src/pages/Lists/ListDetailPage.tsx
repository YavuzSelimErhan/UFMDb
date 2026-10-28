import { useLayoutEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import {
  ChevronLeft,
  Pencil,
  Trash2,
  Check,
  X,
  Heart,
  Link2,
  Eye,
  ListVideo,
  Plus,
} from "lucide-react";
import { listService } from "@/services";
import { useAppSelector } from "@/store";
import RandomPicker from "@/components/random/RandomPicker";
import MovieCard from "@/components/movie/MovieCard";
import { useScreeningLogModal } from "@/hooks/useScreeningLogModal";
import { getListTheme } from "@/utils/listTheme";
import { pickListText } from "@/utils/listText";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import type { ListDetail } from "@/types";
import "./ListDetailPage.css";

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Kürasyon notu: varsayılan olarak 4 satıra kırpılır, kırpıldıysa "devamını oku" gösterilir.
function ListItemNote({ text }: { text: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !expanded) setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className="list-detail-page__note-wrap">
      <p
        ref={ref}
        className={`list-detail-page__note ${expanded ? "is-expanded" : ""}`}
      >
        {text}
      </p>
      {(isClamped || expanded) && (
        <button
          type="button"
          className="list-detail-page__note-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t("common.showLess") : t("common.showMore")}
        </button>
      )}
    </div>
  );
}

export default function ListDetailPage() {
  // Bildirimlerdeki eski linkler /lists/{guid} biçiminde: parametre GUID ise id ile, değilse slug ile çek.
  const { slug: param = "" } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { isAuthenticated, isSessionChecked } = useAppSelector((s) => s.auth);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { openLog, logModal } = useScreeningLogModal();

  const {
    data: list,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["list", param],
    queryFn: () =>
      GUID_RE.test(param)
        ? listService.getById(param)
        : listService.getBySlug(param),
    enabled: !!param && isSessionChecked,
    retry: (count, err) =>
      // Erişim yoksa backend 404 döner; tekrar denemenin anlamı yok.
      !(isAxiosError(err) && err.response?.status === 404) && count < 1,
  });

  const deleteMutation = useMutation({
    mutationFn: () => listService.remove(list!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.removeQueries({ queryKey: ["list"] });
      navigate("/lists");
    },
  });

  // Izgaradaki ListCard ile aynı mantık; detaydan da beğeni kaldırılabilir.
  const likeMutation = useMutation({
    mutationFn: () => listService.toggleLike(list!.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["list", param] });
      const previous = queryClient.getQueryData<ListDetail>(["list", param]);
      if (previous) {
        queryClient.setQueryData<ListDetail>(["list", param], {
          ...previous,
          isLikedByCurrentUser: !previous.isLikedByCurrentUser,
          likeCount: previous.isLikedByCurrentUser
            ? Math.max(0, previous.likeCount - 1)
            : previous.likeCount + 1,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["list", param], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  if (isLoading || !isSessionChecked)
    return <PageSpinner label={t("common.loading")} />;

  if (isError && isAxiosError(error) && error.response?.status === 404)
    return (
      <div className="container list-detail-page">
        <EmptyState
          icon={<ListVideo size={28} />}
          title={t("lists.notFound")}
        />
        <p className="text-muted list-detail-page__not-found-hint">
          {t("lists.notFoundHint")}
        </p>
        <div className="list-detail-page__not-found-cta">
          <Link to="/lists" className="btn-primary">
            {t("lists.backToLists")}
          </Link>
        </div>
      </div>
    );

  if (isError || !list)
    return (
      <PageError
        message={t("errors.listDetailFailed")}
        onRetry={() => refetch()}
      />
    );

  const displayTitle = pickListText(list.titleTr, list.title, i18n.language);
  const displayDescription = pickListText(
    list.descriptionTr,
    list.description,
    i18n.language,
  );
  const theme = getListTheme(list.id);
  const themeStyle = {
    "--list-accent": theme.accent,
    "--list-accent-soft": theme.accentSoft,
    "--list-accent-strong": theme.accentStrong,
    "--card-accent": theme.accent,
  } as React.CSSProperties;

  const first = list.items[0]?.movie;
  const heroImg = list.coverImageUrl || first?.backdropUrl || first?.posterUrl;

  // Backend'in hesapladığı değer: sahibi veya admin. Resmi liste kuralı da orada.
  const canEdit = list.canEdit;

  // Sadece sahibi/admin için anlamlı: liste herkese açık keşifte görünmüyorsa nedenini söyle.
  const notice =
    list.status === "Draft"
      ? t("lists.draftNotice")
      : list.status === "Archived"
        ? t("lists.archivedNotice")
        : list.visibility === "Private"
          ? t("lists.privateNotice")
          : list.visibility === "Unlisted"
            ? t("lists.unlistedNotice")
            : null;

  // Özel liste herkese kopyalanacak bir link üretmesin.
  const canShare = list.visibility !== "Private" && list.status === "Published";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/lists/${list.slug}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Panoya erişim reddedildi (ör. http bağlamı): sessizce geç.
    }
  };

  return (
    <div className="container list-detail-page" style={themeStyle}>
      <div className="list-detail-page__top-row">
        <Link to="/lists" className="list-detail-page__back">
          <ChevronLeft size={16} /> {t("lists.backToLists")}
        </Link>

        {canEdit && (
          <div className="list-detail-page__owner-actions">
            <Link
              to={`/lists/edit/${list.id}`}
              className="list-detail-page__edit-btn"
            >
              <Pencil size={13} /> <span>{t("lists.editList")}</span>
            </Link>

            {!isDeleteOpen ? (
              <button
                type="button"
                className="list-detail-page__delete-btn"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 size={13} /> <span>{t("lists.deleteList")}</span>
              </button>
            ) : (
              <div className="list-detail-page__delete-confirm">
                <span>{t("lists.deleteConfirm")}</span>
                <button
                  type="button"
                  className="list-detail-page__delete-confirm-yes"
                  disabled={deleteMutation.isPending}
                  aria-label={t("common.confirm")}
                  onClick={() => deleteMutation.mutate()}
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  className="list-detail-page__delete-confirm-no"
                  disabled={deleteMutation.isPending}
                  aria-label={t("common.cancel")}
                  onClick={() => setIsDeleteOpen(false)}
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {canEdit && notice && (
        <div className="list-detail-page__notice" role="status">
          {notice}
        </div>
      )}

      {heroImg && (
        <div className="list-detail-page__hero">
          <img src={heroImg} alt="" className="list-detail-page__hero-img" />
          <div className="list-detail-page__hero-scrim" />
        </div>
      )}

      <div className="list-detail-page__perf" aria-hidden="true" />

      <div className="list-detail-page__header">
        <div className="list-detail-page__meta-row">
          <span className="list-detail-page__ticket">
            {list.items.length} {t("lists.moviesCount")}
          </span>

          {isAuthenticated && (
            <button
              type="button"
              className={`list-detail-page__like ${list.isLikedByCurrentUser ? "is-active" : ""}`}
              disabled={likeMutation.isPending}
              aria-label={
                list.isLikedByCurrentUser ? t("movie.unlike") : t("movie.like")
              }
              onClick={() => likeMutation.mutate()}
            >
              <Heart
                size={14}
                fill={list.isLikedByCurrentUser ? "currentColor" : "none"}
              />
              <span>{list.likeCount}</span>
            </button>
          )}

          {!isAuthenticated && list.likeCount > 0 && (
            <span className="list-detail-page__stat">
              <Heart size={13} fill="currentColor" /> {list.likeCount}
            </span>
          )}

          <span
            className="list-detail-page__stat"
            title={t("lists.views", { count: list.viewCount })}
          >
            <Eye size={13} /> {list.viewCount}
          </span>

          {canShare && (
            <button
              type="button"
              className="list-detail-page__share"
              onClick={copyLink}
            >
              {copied ? <Check size={13} /> : <Link2 size={13} />}
              <span>
                {copied ? t("lists.linkCopied") : t("lists.copyLink")}
              </span>
            </button>
          )}
        </div>

        <h1>{displayTitle}</h1>
        {!list.isOfficial && (
          <p className="list-detail-page__creator text-muted">
            {t("lists.byUser", { name: list.createdByUserName })}
          </p>
        )}
        {displayDescription && (
          <p className="text-secondary">{displayDescription}</p>
        )}
      </div>

      {/* Boş listede bileşen kendiliğinden hiçbir şey çizmez. */}
      <RandomPicker
        className="list-detail-page__random"
        source={list.items.map((i) => i.movie)}
        allowExcludeWatched={isAuthenticated}
        showHint
      />

      {list.items.length === 0 ? (
        <>
          <EmptyState
            icon={<ListVideo size={28} />}
            title={t("lists.emptyDetail")}
          />
          {canEdit && (
            <div className="list-detail-page__not-found-cta">
              <Link to={`/lists/edit/${list.id}`} className="btn-primary">
                <Plus size={15} /> {t("lists.addFilms")}
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="movie-grid">
          {list.items.map((item, idx) => {
            const note = pickListText(
              item.noteTr ?? "",
              item.note ?? "",
              i18n.language,
            );
            return (
              <div key={item.movie.id} className="list-detail-page__item">
                {list.isRanked && (
                  <span className="list-detail-page__rank">{idx + 1}</span>
                )}
                <MovieCard
                  movie={item.movie}
                  onLogClick={() => openLog(item.movie)}
                />
                {note && <ListItemNote text={note} />}
              </div>
            );
          })}
        </div>
      )}
      {logModal}
    </div>
  );
}
