import { NavMenu } from "./nav/NavMenu"
import { BackForwardBar } from "./nav/BackForwardBar"
import { SubmitResetBar } from "./nav/SubmitResetBar"

/**
 * The React tree mounted into `<div id="nav-container">`. Holds the bottom
 * navigation bar (back/forward + page number), the contents/TOC menu, and
 * the activity submit/reset pair.
 */
export function NavRoot() {
  return (
    <>
      <NavMenu />
      <BackForwardBar />
      <SubmitResetBar />
    </>
  )
}
