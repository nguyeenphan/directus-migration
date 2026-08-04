import type { Metadata } from 'next';
import { Geist_Mono, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';

import { SUPPORTED_LANGUAGES } from '@/constants/locales';
import { isLocale } from '@/models/common';
import { getDictionary } from '@/providers/dictionary';
import { cn } from '@/utils/cn';
import { createTranslate } from '@/utils/translate';

import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono-family',
});

const THEME_SCRIPT = `try{if(localStorage.getItem('directus-migration-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export const generateStaticParams = () =>
  SUPPORTED_LANGUAGES.map((lang) => ({ lang }));

export const generateMetadata = async ({
  params,
}: LayoutProps<'/[lang]'>): Promise<Metadata> => {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const translate = createTranslate(await getDictionary(lang));

  return {
    title: translate('meta-title'),
    description: translate('meta-description'),
  };
};

const RootLayout = async ({ children, params }: LayoutProps<'/[lang]'>) => {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}

      suppressHydrationWarning
      className={cn(
        'h-full font-sans antialiased',
        inter.variable,
        geistMono.variable,
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
};

export default RootLayout;
