"use client";
import { useEffect } from "react";
export function BrowserMenuGuard() {
  useEffect(() => {
    const prevent = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);
  return null;
}
