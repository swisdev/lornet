import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LORNET_LOGO_SOURCE } from '@/components/lornet-brand'

export const metadata: Metadata = {
  title: { default: 'Lornet — A connected digital ecosystem', template: '%s | Lornet' },
  description: 'Explore a connected network of open websites and digital projects built by Lornet.',
  generator: 'Next.js',
  icons: {
    icon: [{ url: LORNET_LOGO_SOURCE, type: 'image/png' }],
    shortcut: LORNET_LOGO_SOURCE,
    apple: LORNET_LOGO_SOURCE,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f9f9f8',
  userScalable: true,
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="light">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
