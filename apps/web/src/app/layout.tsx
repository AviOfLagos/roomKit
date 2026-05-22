import type { Metadata } from 'next';
import './index.css';

export const metadata: Metadata = {
  title: 'roomKit — Standalone WebRTC + AI Meeting Platform',
  description: 'Instant meeting rooms with baked-in AI participants, real-time speech transcription, and automated summaries.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
