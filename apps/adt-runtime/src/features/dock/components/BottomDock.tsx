import { useAtomValue } from "jotai";
import { appConfigAtom } from "@/shared/state/config.atoms";
import { activityModeAtom } from "@/features/activity/state/activity.atoms";
import { dockReadyAtom } from "@/shared/state/ui.atoms";
import { BookMetadata } from "@/features/dock/components/BookMetadata";
import { Dock } from "@/features/dock/components/Dock";
import { DockActivityActions } from "@/features/activity/components/DockActivityActions";
import { DockMenu } from "@/features/dock/components/DockMenu";
import { DockSkeleton } from "@/features/dock/components/DockSkeleton";
import { PageNav } from "@/features/navigation/components/PageNav";

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
