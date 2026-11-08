// Lenis smooth scroll driven by the GSAP ticker, so ScrollTrigger and Lenis share one clock.
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let lenis = null;
export function startLenis() {
  if (lenis || reduced()) return lenis;
  lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}
export const lockScroll = (on) => {
  if (lenis) on ? lenis.stop() : lenis.start();
  document.documentElement.style.overflow = on ? "hidden" : "";
};
export const scrollTop = () => (lenis ? lenis.scrollTo(0, { duration: 0.8 }) : window.scrollTo({ top: 0, behavior: "smooth" }));

export { gsap, ScrollTrigger };
