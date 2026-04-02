import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type PresetChangeAlertDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

export function PresetChangeAlertDialog({
  open,
  onOpenChange,
  onCancel,
  onConfirm,
}: PresetChangeAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change preset?</AlertDialogTitle>
          <AlertDialogDescription>
            Switching presets will reset your layout, image processing, and language settings to the new
            preset's defaults. Your book name, PDF file, and page range will be kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep current settings</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Switch preset</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
