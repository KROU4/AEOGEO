import type { ContentItem } from "../types";

export function renderFaq(
  items: ContentItem[],
  container: HTMLElement,
  onInteract?: (itemId: string) => void,
): void {
  const wrapper = document.createElement("div");
  wrapper.classList.add("aeogeo-faq");

  items.forEach((item) => {
    const card = document.createElement("div");
    card.classList.add("aeogeo-faq-item");

    const question = document.createElement("button");
    question.classList.add("aeogeo-faq-question");
    question.setAttribute("aria-expanded", "false");
    question.innerHTML = `
      <span class="aeogeo-faq-question-text">${escapeHtml(item.title)}</span>
      <span class="aeogeo-faq-chevron" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `;

    const answer = document.createElement("div");
    answer.classList.add("aeogeo-faq-answer");
    answer.setAttribute("role", "region");
    answer.hidden = true;

    const answerContent = document.createElement("div");
    answerContent.classList.add("aeogeo-faq-answer-content");
    answerContent.textContent = item.body;
    answer.appendChild(answerContent);

    question.addEventListener("click", () => {
      const expanded = question.getAttribute("aria-expanded") === "true";
      question.setAttribute("aria-expanded", String(!expanded));
      answer.hidden = expanded;
      card.classList.toggle("aeogeo-faq-item--open", !expanded);
      if (!expanded) {
        onInteract?.(item.id);
      }
    });

    card.appendChild(question);
    card.appendChild(answer);
    wrapper.appendChild(card);
  });

  container.appendChild(wrapper);
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
