import { useAtomValue } from "jotai";
import { appConfigAtom } from "@/state/config.atoms";
import { isActivityPageAtom } from "@/state/activity.atoms";
import { dockReadyAtom } from "@/state/ui.atoms";
import { BookMetadata } from "./BookMetadata";
import { Dock } from "./Dock";
import { DockActivityActions } from "./DockActivityActions";
import { DockMenu } from "./DockMenu";
import { DockSkeleton } from "./DockSkeleton";
import { PageNav } from "./PageNav";

export function BottomDock() {
  const ready = useAtomValue(dockReadyAtom);
  const isActivity = useAtomValue(isActivityPageAtom);

  let contents: React.ReactNode;
  if (!ready) {
    // Skeleton until boot finishes — prevents the reader→activity flash on
    // activity pages and the empty→loaded flash on regular pages.
    contents = <DockSkeleton />;
  } else if (isActivity) {
    contents = <DockActivityActions />;
  } else {
    contents = <ReaderDockContents />;
  }

  return <Dock>{contents}</Dock>;
}

function ReaderDockContents() {
  const features = useAtomValue(appConfigAtom).features;
  return (
    <>
      <BookMetadata />
      {features.showNavigationControls && <PageNav />}
      <DockMenu />
    </>
  );
}
