import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/store";
import { setCredentials, logout } from "@/store/authSlice";
import { authService } from "@/services";

// Access token 15 dk ömürlü; süre dolmadan pay bırakarak 14 dk'da bir sessizce yenile.
const REFRESH_INTERVAL_MS = 14 * 60 * 1000;

export default function SessionManager() {
  const dispatch = useAppDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Access token sadece bellekte tutulduğu için sayfa yenilenince (F5) kaybolur.
    // Uygulama her açıldığında, httpOnly cookie'deki refresh token ile oturumu
    // sessizce geri yüklemeyi deniyoruz.
    const restoreSession = async () => {
      try {
        const data = await authService.refresh();
        dispatch(setCredentials(data));
      } catch {
        dispatch(logout());
      }
    };
    restoreSession();

    intervalRef.current = setInterval(async () => {
      try {
        const data = await authService.refresh();
        dispatch(setCredentials(data));
      } catch {
        dispatch(logout());
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [dispatch]);

  return null;
}
