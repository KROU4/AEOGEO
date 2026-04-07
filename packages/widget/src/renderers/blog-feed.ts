import type { ContentItem } from "../types";

export function renderBlogFeed(
  items: ContentItem[],
  container: HTMLElement,
  onInteract?: (itemId: string) => void,
): void {
  const wrapper = document.createElement("div");
  wrapper.classList.add("aeogeo-blog-feed");

  items.forEach((item) => {
    const card = document.createElement("article");
    card.classList.add("aeogeo-blog-card");
    card.addEventListener("click", () => onInteract?.(item.id));

    const title = document.createElement("h3");
    title.classList.add("aeogeo-blog-title");
    title.textContent = item.title;

    const excerpt = document.createElement("p");
    excerpt.classList.add("aeogeo-blog-excerpt");
    excerpt.textContent = item.body;

    const meta = document.createElement("time");
    meta.classList.add("aeogeo-blog-date");
    meta.setAttribute("datetime", item.published_at);
    meta.textContent = formatDate(item.published_at);

    card.appendChild(title);
    card.appendChild(excerpt);
    card.appendChild(meta);
    wrapper.appendChild(card);
  });

  container.appendChild(wrapper);
}


function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}
