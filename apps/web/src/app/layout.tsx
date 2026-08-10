import type { Metadata } from 'next'
import '@wos/ui/styles'
import { Lexend, JetBrains_Mono } from 'next/font/google'

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-lexend',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'WOS — Wira Operating System',
  description: 'Personal finance, wealth, net worth, vault & todo dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${lexend.variable} ${jetbrains.variable}`}>
      <body className="font-(family-name:--font-lexend)">{children}</body>
    </html>
  )
}
