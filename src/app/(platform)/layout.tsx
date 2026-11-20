import { App } from "@/components/app";
export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <App />
      {children}
    </>
  );
}
