import { Link } from "react-router-dom";

import { SeoPage } from "./SeoPage";
import { routes } from "../lib/routes";

export function NotFoundPage() {
  return (
    <SeoPage title="Page not found" description="The requested page does not exist." path="/404" noindex>
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-600">404</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">Page not found</h1>
          <p className="mt-4 text-slate-600">
            This route is unavailable. Use the public landing page or return to the secure login screen.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to={routes.home} className="rounded-xl bg-sky-600 px-5 py-3 text-white hover:bg-sky-700">
              Public home
            </Link>
            <Link
              to={routes.login}
              className="rounded-xl border border-slate-200 px-5 py-3 text-slate-700 hover:border-sky-300 hover:text-sky-700"
            >
              Login
            </Link>
          </div>
        </section>
      </main>
    </SeoPage>
  );
}
