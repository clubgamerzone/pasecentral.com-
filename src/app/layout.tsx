import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Pase Central · Cada noche empieza aquí",
  description:
    "Entradas, taquilla y control de acceso para tus eventos. Todo en un mismo lugar.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
