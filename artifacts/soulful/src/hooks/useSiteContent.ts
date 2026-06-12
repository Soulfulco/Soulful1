import { useQuery } from "@tanstack/react-query";

type ContentRow = { key: string; value: string; label: string; section: string };

export function useSiteContent() {
  const { data = [] } = useQuery<ContentRow[]>({
    queryKey: ["site-content"],
    queryFn: async () => {
      const res = await fetch("/api/site-content");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const map = Object.fromEntries(data.map(r => [r.key, r.value]));

  return function c(key: string, fallback: string): string {
    return map[key] ?? fallback;
  };
}
