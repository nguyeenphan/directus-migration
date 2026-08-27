import { notFound, redirect } from 'next/navigation';

import { route, ROUTES } from '@/lib/routes';
import { isLocale } from '@/models/common';

const Home = async ({ params }: PageProps<'/[lang]'>) => {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  redirect(route(lang, ROUTES.MIGRATE));
};

export default Home;
