import { notFound, redirect } from 'next/navigation';

import { isLocale } from '@/models/common';
import { route, ROUTES } from '@/routes';

const Home = async ({ params }: PageProps<'/[lang]'>) => {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  redirect(route(lang, ROUTES.MIGRATE));
};

export default Home;
