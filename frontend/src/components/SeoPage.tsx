import { useSeo } from "../lib/seo";

type Props = {
  title: string;
  description?: string;
  path?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  children: React.ReactNode;
};

export function SeoPage({ children, ...seo }: Props) {
  useSeo(seo);
  return <>{children}</>;
}

