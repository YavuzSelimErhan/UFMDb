// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LogScreeningModal from "@/components/movie/LogScreeningModal";

const mocks = vi.hoisted(() => ({
  log: vi.fn(), setReaction: vi.fn(), getById: vi.fn(), showToast: vi.fn(),
}));
vi.mock("@/services", () => ({
  movieService: { getById: mocks.getById, setReaction: mocks.setReaction },
  screeningLogService: { log: mocks.log },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/common/Toast", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

function openModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const movie = { id: "film", title: "Umut" };
  client.setQueryData(["movie", movie.id], { currentUserReaction: "Like" });
  mocks.getById.mockResolvedValue({ currentUserReaction: "Like" });
  const close = vi.fn();
  render(<QueryClientProvider client={client}><LogScreeningModal movie={movie} onClose={close} /></QueryClientProvider>);
  return close;
}

it.each([false, true])("saves one screening even when saving the reaction fails=%s", async fails => {
  mocks.log.mockResolvedValue("entry");
  if (fails) mocks.setReaction.mockRejectedValue(new Error("offline"));
  else mocks.setReaction.mockResolvedValue(undefined);
  const close = openModal();
  const time = document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
  fireEvent.change(time, { target: { value: "2020-04-02T21:35" } });
  fireEvent.click(screen.getByRole("button", { name: "movie.notForMe" }));
  fireEvent.click(screen.getByRole("button", { name: "log.addEntrySubmit" }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(mocks.log).toHaveBeenCalledTimes(1);
  expect(mocks.log).toHaveBeenCalledWith("film", new Date("2020-04-02T21:35").toISOString(), null);
  expect(mocks.setReaction).toHaveBeenCalledWith("film", "Dislike", "Like");
  if (fails) expect(mocks.showToast).toHaveBeenCalledWith("log.reactionSaveError", "error");
  else expect(mocks.showToast).not.toHaveBeenCalled();
});

it("allows a failed log submission to be retried before saving its reaction", async () => {
  mocks.log.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("entry");
  const close = openModal();
  const submit = screen.getByRole("button", { name: "log.addEntrySubmit" });
  fireEvent.click(submit);
  await waitFor(() => expect(mocks.log).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
  expect(close).not.toHaveBeenCalled();
  expect(mocks.setReaction).not.toHaveBeenCalled();
  fireEvent.click(submit);
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(mocks.log).toHaveBeenCalledTimes(2);
  expect(mocks.setReaction).toHaveBeenCalledTimes(1);
});
