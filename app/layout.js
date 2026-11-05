import "./globals.css";

export const metadata = {
  title: "409 Wholesale",
  description: "Dealer-to-dealer wholesale by 409 Motor Company",
  robots: { index: false, follow: false },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#121314" };

export default function RootLayout({ children }) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
