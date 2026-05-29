import logoUrl from "../assets/logo.png"

function SplashLogo() {
  return (
    <div className="relative flex items-center justify-center">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-[36%] blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(59,130,246,0.45), rgba(59,130,246,0) 70%)",
          transform: "scale(1.35)",
        }}
      />
      <img
        src={logoUrl}
        alt=""
        width={120}
        height={120}
        className="animate-[splash-icon-float_4.5s_ease-in-out_infinite]"
        style={{
          filter:
            "drop-shadow(0 18px 36px rgba(43,127,255,0.32)) drop-shadow(0 2px 6px rgba(15,23,42,0.12))",
        }}
      />
    </div>
  )
}

export { SplashLogo }
