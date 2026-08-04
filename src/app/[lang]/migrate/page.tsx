import { notFound } from 'next/navigation';

import { TranslationProvider } from '@/contexts/translationContext';
import { isLocale } from '@/models/common';
import { getDictionary } from '@/providers/dictionary';

import { MigrationWizard } from './components/migrationWizard';

const MigratePage = async ({ params }: PageProps<'/[lang]/migrate'>) => {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <TranslationProvider locale={lang} dictionary={await getDictionary(lang)}>
      <MigrationWizard />
    </TranslationProvider>
  );
};

export default MigratePage;
