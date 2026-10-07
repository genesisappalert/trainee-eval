import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "MTP Assessment Platform — Genesis Group",
  description:
    "Management Trainee Programme performance assessment platform. Complete your self-assessment and supervisor evaluations online.",
  icons: {
    icon: "/genesis-logo.png",
    shortcut: "/genesis-logo.png",
    apple: "/genesis-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
