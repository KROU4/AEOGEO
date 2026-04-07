const INJECTED_ATTR = "data-aeogeo-jsonld";

export function injectJsonLd(jsonLdString: string, embedToken: string): void {
  const existing = document.querySelector(
    `script[${INJECTED_ATTR}="${embedToken}"]`,
  );
  if (existing) {
    existing.textContent = jsonLdString;
    return;
  }

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute(INJECTED_ATTR, embedToken);
  script.textContent = jsonLdString;
  document.head.appendChild(script);
}
