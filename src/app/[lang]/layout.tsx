import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { notFound } from 'next/navigation';

import { SUPPORTED_LANGUAGES } from '@/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionary';
import { createTranslate } from '@/lib/i18n/translate';
import { isLocale } from '@/models/common';
import { cn } from '@/utils/cn';

import '../globals.css';

// Not a variable font: only the two weights the theme uses are loaded.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['500', '900'],
  variable: '--font-sans',
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
      className={cn('h-full font-sans antialiased', beVietnamPro.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
};

export default RootLayout;
