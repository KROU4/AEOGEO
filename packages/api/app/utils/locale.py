LOCALE_NAMES: dict[str, str] = {"en": "English", "ru": "Russian"}


def locale_instruction(locale: str) -> str:
    """Return a prompt suffix instructing the LLM to output in the given language."""
    lang = LOCALE_NAMES.get(locale, "English")
    if lang == "English":
        return ""
    return f"\n\nIMPORTANT: Return ALL text values in {lang}."
