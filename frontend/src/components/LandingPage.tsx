import { Link } from "react-router-dom";
import { Activity, CalendarDays, ShieldCheck, Users } from "lucide-react";

import { SeoPage } from "./SeoPage";
import { routes } from "../lib/routes";
import { absoluteUrl } from "../lib/site";

const highlights = [
  {
    title: "Управление спортсменами",
    description: "Профили, контакты, посещаемость и прогресс собраны в одном месте и доступны для команды.",
    icon: Users,
  },
  {
    title: "Планирование тренировок",
    description: "Расписание занятий, тренировочные планы и календарь помогают видеть нагрузку заранее.",
    icon: CalendarDays,
  },
  {
    title: "Медицинский контроль",
    description: "Учет травм и ограничений снижает риски и помогает принимать решения на основе актуальных данных.",
    icon: ShieldCheck,
  },
  {
    title: "Рабочая панель тренера",
    description: "На одном экране видно активных спортсменов, динамику посещаемости и ближайшие занятия.",
    icon: Activity,
  },
];

export function LandingPage() {
  return (
    <SeoPage
      title="Платформа для управления спортивной командой"
      description="Trainer Pro помогает вести спортсменов, тренировки, посещаемость, отчеты и ежедневную работу тренерского штаба."
      path={routes.home}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Trainer Pro",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: absoluteUrl(routes.home),
        description:
          "Веб-приложение для управления спортсменами, тренировками, посещаемостью, отчетами и операционной работой тренера.",
      }}
    >
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_transparent_35%),linear-gradient(180deg,_#f8fafc,_#eef2ff_55%,_#ffffff)] text-slate-900">
        <section className="mx-auto max-w-6xl px-6 py-20">
          <header className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm text-sky-700 shadow-sm">
                Публичная страница проекта
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight">
                Вся работа тренера, данные спортсменов и план тренировок в одной платформе
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Trainer Pro это публичная точка входа в MVP. Эту страницу можно открывать всем,
                а внутренняя рабочая зона тренера и данные команды остаются защищены авторизацией.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to={routes.login}
                  className="rounded-xl bg-sky-600 px-6 py-3 text-white transition-colors hover:bg-sky-700"
                >
                  Войти в рабочее пространство
                </Link>
                <a
                  href="#features"
                  className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-slate-700 transition-colors hover:border-sky-300 hover:text-sky-700"
                >
                  Посмотреть возможности
                </a>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(37,99,235,0.14)] backdrop-blur">
              <h2 className="text-2xl font-semibold">Что находится на публичной странице</h2>
              <div className="mt-6 space-y-4 text-sm leading-6 text-slate-600">
                <section>
                  <h3 className="font-medium text-slate-900">Открытый раздел</h3>
                  <p>Главная страница `/` с описанием продукта, преимуществ и понятной структурой для посетителя.</p>
                </section>
                <section>
                  <h3 className="font-medium text-slate-900">Закрытый раздел</h3>
                  <p>`/login` и все маршруты `/app/*`, потому что там находятся аккаунты, команда и внутренние данные.</p>
                </section>
                <section>
                  <h3 className="font-medium text-slate-900">Главная цель страницы</h3>
                  <p>Кратко объяснить, что умеет сервис, кому он нужен и почему в него стоит перейти дальше.</p>
                </section>
              </div>
            </aside>
          </header>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 pb-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-semibold">Возможности платформы</h2>
            <p className="mt-3 text-slate-600">
              Раздел `#features` нужен, чтобы сразу показать ключевые функции продукта.
              Он помогает быстро понять ценность сервиса без входа в систему и без доступа к закрытым данным.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-slate-600">{item.description}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </SeoPage>
  );
}
