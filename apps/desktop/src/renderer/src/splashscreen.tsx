import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { SplashView } from "./components/SplashView"
import { DebugView } from "./components/DebugView"

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const splashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: SplashView,
})

const debugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/debug",
  component: DebugView,
})

const routeTree = rootRoute.addChildren([splashRoute, debugRoute])

// Memory history — the splash is loaded via `file://` in packaged builds,
// where browser/hash history is awkward. The splash is also short-lived,
// so persisting the route across reloads has no benefit.
const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/"] }),
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

export function Splashscreen() {
  return <RouterProvider router={router} />
}
