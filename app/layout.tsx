import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseBoard",
  description: "A secure workspace dashboard powered by Supabase.",
};

const themeScript = `
  try {
    var theme = localStorage.getItem("pulseboard-theme");
    var useDark = theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", useDark);
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
