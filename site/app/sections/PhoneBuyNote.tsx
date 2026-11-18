"use client";

// Under the Buy buttons on a phone, as halo-mac.com's (js/site.js, "send-mac-note"): buying on the phone works (the
// receipt email carries the download link and the license key), and a link to send the page to the PC: the share
// sheet where there is one, otherwise an email to yourself. Only on touch screens; nothing is collected.
import { useSyncExternalStore } from "react";
import { product } from "@/lib/product";
import styles from "./PhoneBuyNote.module.css";

const COARSE = "(pointer: coarse)";
const subscribe = (on: () => void) => {
  const m = window.matchMedia(COARSE);
  m.addEventListener("change", on);
  return () => m.removeEventListener("change", on);
};

export default function PhoneBuyNote({ dark = false }: { dark?: boolean }) {
  const touch = useSyncExternalStore(subscribe, () => window.matchMedia(COARSE).matches, () => false);
  if (!touch) return null;
  const url = product.siteUrl;
  const mail = `mailto:?subject=${encodeURIComponent(`${product.name} for my PC`)}&body=${encodeURIComponent(`Install ${product.name} on my PC: ${url}`)}`;
  const send = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!navigator.share) return; // the mailto: link opens Mail
    e.preventDefault();
    try {
      await navigator.share({ title: product.name, text: `${product.name}, an island for my Windows screen`, url });
    } catch (err) {
      if ((err as Error).name !== "AbortError") window.location.href = mail; // blocked rather than closed
    }
  };
  return (
    <>
      <p className={`${styles.note} ${dark ? styles.dark : ""}`}>
        Buy on your phone, install on your PC: the download link and license key arrive by email.
      </p>
      <a className={styles.send} href={mail} onClick={send}>
        Or send the link to your PC ›
      </a>
    </>
  );
}
