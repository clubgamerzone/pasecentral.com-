import type { Metadata } from "next";
import "./globals.css";
import { BrowserMenuGuard } from "@/components/browser-menu-guard";
export const metadata: Metadata = {
  title: "Pase Central · Cada noche empieza aquí",
  description:
    "Entradas, taquilla y control de acceso para tus eventos. Todo en un mismo lugar.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <BrowserMenuGuard />
        {children}
      </body>
    </html>
  );
}
