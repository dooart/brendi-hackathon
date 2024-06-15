import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { fontHeading, fontSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hackathon Starter - OpenAI",
  description: "Hackathon Starter - OpenAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn("font-sans", fontSans.variable, fontHeading.variable)}>
        <main className="container max-w-screen-md">{children}</main>
      </body>
    </html>
  );
}
