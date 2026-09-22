import { useState } from "react";
import LogScreeningModal, {
  type LoggableMovie,
} from "@/components/movie/LogScreeningModal";

/**
 * MovieCard'ların bulunduğu her sayfada tekrar eden state'i (hangi film
 * için log modali açık) ve modalin kendisini tek yerden sağlar.
 *
 * Kullanım:
 *   const { openLog, logModal } = useScreeningLogModal();
 *   <MovieCard movie={m} onLogClick={() => openLog(m)} />
 *   ...
 *   {logModal}
 */
export function useScreeningLogModal() {
  const [loggingMovie, setLoggingMovie] = useState<LoggableMovie | null>(
    null,
  );

  const logModal = loggingMovie ? (
    <LogScreeningModal
      movie={loggingMovie}
      onClose={() => setLoggingMovie(null)}
    />
  ) : null;

  return { openLog: setLoggingMovie, logModal };
}
