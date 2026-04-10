import { useEffect } from "react";

import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME, absoluteUrl } from "./site";

type MetaConfig = {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  type?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function upsertMeta(name: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${name}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(name, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function upsertJsonLd(jsonLd: MetaConfig["jsonLd"]) {
  const id = "seo-json-ld";
  const previous = document.getElementById(id);
  if (!jsonLd) {
    previous?.remove();
    return;
  }

  const script = previous ?? document.createElement("script");
  script.id = id;
  script.setAttribute("type", "application/ld+json");
  script.textContent = JSON.stringify(jsonLd);
  if (!previous) {
    document.head.appendChild(script);
  }
}

export function useSeo(config: MetaConfig) {
  useEffect(() => {
    const fullTitle = config.title.includes(DEFAULT_SITE_NAME)
      ? config.title
      : `${config.title} | ${DEFAULT_SITE_NAME}`;
    const description = config.description ?? DEFAULT_SITE_DESCRIPTION;
    const canonical = absoluteUrl(config.path ?? "/");
    const image = absoluteUrl(config.image ?? "/social-preview.svg");
    const robots = config.noindex ? "noindex, nofollow" : "index, follow";

    document.title = fullTitle;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", robots);
    upsertMeta("property", "og:site_name", DEFAULT_SITE_NAME);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", config.type ?? "website");
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", image);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);
    upsertLink("canonical", canonical);
    upsertJsonLd(config.jsonLd);
  }, [config]);
}
