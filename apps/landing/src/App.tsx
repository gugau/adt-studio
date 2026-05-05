import { useEffect, useMemo } from "react";
import { DownloadPage } from "@/components/pages/DownloadPage";
import { ReleasePage } from "@/components/pages/ReleasePage";
import { ReleasesPage } from "@/components/pages/ReleasesPage";
import { CarouselScene } from "@/components/sections/CarouselScene";
import { FeaturesScene } from "@/components/sections/FeaturesScene";
import { FinaleScene } from "@/components/sections/FinaleScene";
import { Footer } from "@/components/sections/Footer";
import { Nav } from "@/components/sections/Nav";
import { PrinciplesScene } from "@/components/sections/PrinciplesScene";
import { ReleasesScene } from "@/components/sections/ReleasesScene";
import { ShowcaseScene } from "@/components/sections/ShowcaseScene";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { WelcomeScene } from "@/components/sections/WelcomeScene";
import { useHashRoute } from "@/lib/useHashRoute";
import { trackPageView } from "@/lib/matomo";

type Route =
  | { kind: "home" }
  | { kind: "download" }
  | { kind: "releases" }
  | { kind: "release"; tag: string };

function resolveRoute(hashRoute: string): Route {
  if (hashRoute.startsWith("/download")) return { kind: "download" };
  const m = /^\/releases\/([^/?#]+)/.exec(hashRoute);
  if (m) {
    try {
      return { kind: "release", tag: decodeURIComponent(m[1]) };
    } catch {
      return { kind: "release", tag: m[1] };
    }
  }
  if (hashRoute === "/releases" || hashRoute === "/releases/") {
    return { kind: "releases" };
  }
  return { kind: "home" };
}

function getRouteTitle(route: Route): string {
  switch (route.kind) {
    case "home":
      return "ADT Studio — Turn any PDF into an accessible book";
    case "download":
      return "Download — ADT Studio";
    case "releases":
      return "Releases — ADT Studio";
    case "release":
      return `Release ${route.tag} — ADT Studio`;
  }
}

export function App() {
  const hashRoute = useHashRoute();
  const route = useMemo(() => resolveRoute(hashRoute), [hashRoute]);
  const isStaticPage = route.kind !== "home";

  useEffect(() => {
    trackPageView(getRouteTitle(route), window.location.href);
  }, [route]);

  useEffect(() => {
    if (isStaticPage) {
      window.scrollTo({ top: 0, behavior: "auto" });
      document.documentElement.classList.add("no-snap");
      return;
    }
    document.documentElement.classList.remove("no-snap");
    const raw = window.location.hash.replace(/^#/, "");
    if (raw && !raw.startsWith("/")) {
      requestAnimationFrame(() => {
        const el = document.getElementById(raw);
        if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
      });
    }
  }, [isStaticPage, route.kind]);

  return (
    <div className="min-h-screen bg-[color:var(--color-background)] text-[color:var(--color-foreground)]">
      <Nav />
      <main>
        {route.kind === "download" ? (
          <DownloadPage />
        ) : route.kind === "releases" ? (
          <ReleasesPage />
        ) : route.kind === "release" ? (
          <ReleasePage tag={route.tag} />
        ) : (
          <>
            <WelcomeScene />
            <TrustStrip />
            <FeaturesScene />
            <CarouselScene />
            <PrinciplesScene />
            <ShowcaseScene />
            <ReleasesScene />
            <FinaleScene />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
