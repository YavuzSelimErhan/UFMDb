import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// location.key her history entry için sabittir (geri gidince aynı key'e döner),
// bu yüzden scroll pozisyonlarını key'e göre saklıyoruz.
const scrollPositions = new Map<string, number>();

export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const key = location.key;

    if (navigationType === "POP" && scrollPositions.has(key)) {
      const target = scrollPositions.get(key)!;
      let attempts = 0;
      // İçerik (movie grid vb.) async yüklendiği için sayfa henüz o kadar
      // uzun olmayabilir; birkaç frame boyunca tekrar deniyoruz.
      const tryScroll = () => {
        attempts += 1;
        window.scrollTo(0, target);
        const closeEnough = Math.abs(window.scrollY - target) < 2;
        if (!closeEnough && attempts < 30) {
          requestAnimationFrame(tryScroll);
        }
      };
      requestAnimationFrame(tryScroll);
    } else {
      window.scrollTo(0, 0);
    }

    const onScroll = () => scrollPositions.set(key, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scrollPositions.set(key, window.scrollY);
      window.removeEventListener("scroll", onScroll);
    };
  }, [location.key, navigationType]);
}
