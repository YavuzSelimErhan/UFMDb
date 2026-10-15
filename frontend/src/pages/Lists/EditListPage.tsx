import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { listService } from "@/services";
import { useAppSelector } from "@/store";
import ListForm, { type ListFormValues } from "@/components/lists/ListForm";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";

export default function EditListPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isSessionChecked = useAppSelector((s) => s.auth.isSessionChecked);

  // Detay sayfasının önbelleğinden ayrı anahtar ve gcTime: 0, böylece form her açılışta
  // güncel veriyle başlar ve arka plan yenilemesi kullanıcının yazdıklarını ezmez.
  const {
    data: list,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["list-edit", id],
    queryFn: () => listService.getById(id!),
    enabled: !!id && isSessionChecked,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof listService.update>[1]) =>
      listService.update(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list"] });
      navigate(`/lists/${list!.slug}`);
    },
  });

  if (isLoading || !isSessionChecked)
    return <PageSpinner label={t("common.loading")} />;
  if (isError || !list)
    return (
      <PageError
        message={t("errors.listDetailFailed")}
        onRetry={() => refetch()}
      />
    );
  if (!list.canEdit)
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <EmptyState
          icon={<Lock size={28} />}
          title={t("lists.form.noPermission")}
        />
      </div>
    );

  const initial: ListFormValues = {
    title: list.title,
    titleTr: list.titleTr,
    description: list.description,
    descriptionTr: list.descriptionTr,
    coverImageUrl: list.coverImageUrl,
    displayOrder: list.displayOrder ?? 0,
    isRanked: list.isRanked,
    visibility: list.visibility,
    status: list.status,
    isOfficial: list.isOfficial,
    movies: list.items.map((i) => ({
      movieId: i.movie.id,
      title: i.movie.title,
      posterUrl: i.movie.posterUrl,
      note: i.note ?? "",
      noteTr: i.noteTr ?? "",
    })),
  };

  return (
    <ListForm
      key={list.id}
      mode="edit"
      initial={initial}
      isSubmitting={updateMutation.isPending}
      error={updateMutation.error}
      onSubmit={(payload) => updateMutation.mutate(payload)}
    />
  );
}
