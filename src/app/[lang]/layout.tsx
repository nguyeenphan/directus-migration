import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Geist, Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';

import { SUPPORTED_LANGUAGES } from '@/constants/locales';
import { THEME_STORAGE_KEY } from '@/constants/storage';
import { getDictionary } from '@/lib/i18n/dictionary';
import { createTranslate } from '@/lib/i18n/translate';
import { isLocale } from '@/models/common';
import { cn } from '@/utils/cn';

import '../globals.css';

// Geist and Geist Mono are the kit's faces. Be Vietnam Pro stays loaded and
// sits behind Geist in the `--font-sans` stack: Geist has no Vietnamese subset.
const geist = Geist({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-geist',
});

const geistMono = Geist_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-geist-mono',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-sans-vn',
});

const THEME_SCRIPT = `try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

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
        geist.variable,
        geistMono.variable,
        beVietnamPro.variable,
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* The kit's backdrop as a plain CSS grid, no pointer reaction: panels are
          translucent glass, so it reads through them. `--dots-color` lifts it to
          the weight the canvas version had. */}
      <body className="flex h-full flex-col overflow-hidden bg-dots [--dots-color:var(--line-strong)]">
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
