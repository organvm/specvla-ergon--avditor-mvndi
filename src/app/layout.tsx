import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { AmbientResonanceProvider } from "@/components/AmbientResonance";
import ClientBackground from "@/components/ClientBackground";

export const metadata: Metadata = {
  title: {
    default: "Avditor Mvndi | Cosmic Strategy & Digital Alignment",
    template: "%s | Avditor Mvndi",
  },
  description: "Decode your digital bottlenecks and align your business strategy with data-driven, cosmic growth audits powered by AI.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://specvla-ergon-avditor-mvndi.vercel.app"),
  openGraph: {
    title: "Avditor Mvndi",
    description: "AI-powered cosmic growth audits for your digital presence.",
    siteName: "Avditor Mvndi",
    type: "website",
    images: ["/api/og"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Avditor Mvndi",
    description: "AI-powered cosmic growth audits for your digital presence.",
  },
};

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Avditor Mvndi";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <ClientBackground />
        <AmbientResonanceProvider>
          <AuthProvider>
            <PostHogProvider>
              <div className="container" style={{ position: "relative", zIndex: 1 }}>
                <nav className="nav">
                  <Link href="/" className="logo">{APP_NAME}</Link>
                  <div className="nav-links">
                    <Link href="/" className="nav-link">Audit</Link>
                    <Link href="/compare" className="nav-link">Compare</Link>
                    <Link href="/about" className="nav-link">Methodology</Link>
                    <Link href="/examples" className="nav-link">Examples</Link>
                    <Link href="/history" className="nav-link">History</Link>
                    <Link href="/dashboard" className="nav-link">Dashboard</Link>
                    <Link href="/settings" className="nav-link">Settings</Link>
                    <Link href="/docs" className="nav-link">Docs</Link>
                    {session?.user && (
                      <Link href="/admin" className="nav-link">Admin</Link>
                    )}
                    {session?.user ? (
                      <form action={async () => {
                        "use server"
                        await signOut()
                      }} style={{ display: 'inline' }}>
                        <button type="submit" className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          Sign Out ({session.user.name})
                        </button>
                      </form>
                    ) : (
                      <form action={async () => {
                        "use server"
                        await signIn()
                      }} style={{ display: 'inline' }}>
                        <button type="submit" className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          Sign In
                        </button>
                      </form>
                    )}
                  </div>
                </nav>
                {children}
              </div>
            </PostHogProvider>
          </AuthProvider>
        </AmbientResonanceProvider>
      </body>
    </html>
  );
}
