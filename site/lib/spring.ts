/**
 * SwiftUI's .spring(response:dampingFraction:) as an easing, the same helper as halo-mac.com's sp() (js/site.js):
 * `duration` in seconds, `ease(p)` for p from 0 to 1 (it overshoots past 1 and settles).
 */
export function spring(response: number, damping: number) {
  const w = (2 * Math.PI) / response;
  const z = damping;
  const wd = w * Math.sqrt(1 - z * z);
  const duration = Math.log(500) / (z * w);
  const ease = (p: number) =>
    p >= 1 ? 1 : 1 - Math.exp(-z * w * p * duration) * (Math.cos(wd * p * duration) + ((z * w) / wd) * Math.sin(wd * p * duration));
  return { duration, ease };
}
