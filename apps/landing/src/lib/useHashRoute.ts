import { useEffect, useState } from "react";

function readHash(): string {
  if (typeof window === "undefined") return "";
  const raw = window.location.hash.replace(/^#/, "");
  return raw.startsWith("/") ? raw : "";
}

export function useHashRoute(): string {
  const [route, setRoute] = useState<string>(() => readHash());

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return route;
}
