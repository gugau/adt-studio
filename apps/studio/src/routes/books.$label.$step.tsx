import { createFileRoute, Outlet, ErrorComponentProps } from "@tanstack/react-router"
import { ErrorScreen } from "@/components/ErrorScreen"

function BookErrorComponent({ error, reset }: ErrorComponentProps) {
  return <ErrorScreen variant="route" error={error} reset={reset} />
}

export const Route = createFileRoute("/books/$label/$step")({
  component: StepLayout,
  errorComponent: BookErrorComponent,
})

function StepLayout() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <Outlet />
    </div>
  )
}
