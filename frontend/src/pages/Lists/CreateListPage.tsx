import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listService } from "@/services";
import ListForm, { EMPTY_LIST_FORM } from "@/components/lists/ListForm";

export default function CreateListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: listService.create,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      navigate(`/lists/${created.slug}`);
    },
  });

  return (
    <ListForm
      mode="create"
      initial={EMPTY_LIST_FORM}
      isSubmitting={createMutation.isPending}
      error={createMutation.error}
      onSubmit={(payload) => createMutation.mutate(payload)}
    />
  );
}
