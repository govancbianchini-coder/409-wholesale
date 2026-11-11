import "./globals.css";

export const metadata = {
  title: "Overbid",
  description: "Dealer-to-dealer wholesale by 409 Motor Company",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Overbid", statusBarStyle: "black-translucent" },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0f17" };

export default function RootLayout({ children }) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
