import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { personService } from "@/services";
import { PageSpinner, PageError } from "@/components/common/PageState";

export default function LegacyPersonRedirect({
  kind,
}: {
  kind: "actor" | "director";
}) {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data, isError, refetch } = useQuery({
    queryKey: ["legacy-person", kind, id],
    queryFn: () => personService.resolveLegacy(kind, id!),
    enabled: !!id,
    retry: false,
    staleTime: Infinity,
  });

  if (data) return <Navigate to={`/people/${data}`} replace />;
  if (isError)
    return (
      <PageError
        message={t(
          kind === "actor"
            ? "errors.actorDetailFailed"
            : "errors.directorDetailFailed",
        )}
        onRetry={() => refetch()}
      />
    );
  return <PageSpinner label={t("common.loading")} />;
}
