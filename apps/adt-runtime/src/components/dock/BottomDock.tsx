import { useAtomValue } from "jotai";
import { appConfigAtom } from "@/state/config.atoms";
import { activityModeAtom } from "@/state/activity.atoms";
import { dockReadyAtom } from "@/state/ui.atoms";
import { BookMetadata } from "./BookMetadata";
import { Dock } from "./Dock";
import { DockActivityActions } from "./DockActivityActions";
import { DockMenu } from "./DockMenu";
import { DockSkeleton } from "./DockSkeleton";
import { PageNav } from "./PageNav";

export function BottomDock() {
  const ready = useAtomValue(dockReadyAtom);
  const activityMode = useAtomValue(activityModeAtom);

  let contents: React.ReactNode;
  if (!ready) {
    contents = <DockSkeleton />;
  } else if (activityMode) {
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
