import { useEffect } from 'react';

/** Dominio de producción (fuente de verdad para canonical/OG). */
export const SITE_URL = 'https://www.varelapropiedadescde.com.ar';

interface PageMeta {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, unknown>;
}

const setMetaTag = (attr: 'property' | 'name', key: string, value: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
};

const setCanonical = (url: string) => {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
};

/** Actualiza title + meta description + canonical + OG/Twitter + JSON-LD de la
 *  página pública actual. Client-side: no reemplaza SSR, pero corrige lo que ve
 *  Google en su segunda pasada de render (no corrige lo que ven WhatsApp/FB al
 *  compartir un link directo — para eso ya existe el endpoint server-side /share). */
export const usePageMeta = ({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  jsonLd,
}: PageMeta) => {
  useEffect(() => {
    document.title = title;
    setMetaTag('name', 'description', description);
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', description);

    if (canonical) {
      setCanonical(canonical);
      setMetaTag('property', 'og:url', canonical);
    }
    if (ogImage) {
      setMetaTag('property', 'og:image', ogImage);
      setMetaTag('name', 'twitter:image', ogImage);
    }
    if (jsonLd) {
      let script = document.getElementById('page-jsonld') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'page-jsonld';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }
  }, [title, description, canonical, ogImage, ogType, jsonLd]);
};
