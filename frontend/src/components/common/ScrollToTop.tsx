import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router sayfa geçişinde scroll pozisyonunu koruyor (SPA davranışı).
 * Her route değişiminde sayfayı en üste alır — normal çok sayfalı sitelerdeki gibi.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
