import { useEffect, useMemo } from "react";
import { DownloadPage } from "@/components/pages/DownloadPage";
import { ReleasePage } from "@/components/pages/ReleasePage";
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

type Route =
  | { kind: "home" }
  | { kind: "download" }
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
  return { kind: "home" };
}

export function App() {
  const hashRoute = useHashRoute();
  const route = useMemo(() => resolveRoute(hashRoute), [hashRoute]);
  const isStaticPage = route.kind !== "home";

  useEffect(() => {
    if (isStaticPage) {
      window.scrollTo({ top: 0, behavior: "auto" });
      document.documentElement.classList.add("no-snap");
    } else {
      document.documentElement.classList.remove("no-snap");
    }
  }, [isStaticPage, route.kind]);

  return (
    <div className="min-h-screen bg-[color:var(--color-background)] text-[color:var(--color-foreground)]">
      <Nav />
      <main>
        {route.kind === "download" ? (
          <DownloadPage />
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
