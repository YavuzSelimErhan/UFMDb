import { useEffect, useState } from "react";

/** Admin listeleri için ortak durum: arama kutusu (debounce'lu) + sayfa. Arama değişince sayfa 1'e döner. */
export function useAdminListState(delay = 350) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setSearch(input.trim()), delay);
    return () => clearTimeout(id);
  }, [input, delay]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return { input, setInput, search, page, setPage };
}
