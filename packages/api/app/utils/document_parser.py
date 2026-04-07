"""Document parsing utilities.

Supports PDF, DOCX, and TXT files. Each parser extracts plain text
content suitable for chunking and embedding.
"""

from __future__ import annotations

from pathlib import Path


def parse_pdf(file_path: str) -> str:
    """Extract text from a PDF file using PyMuPDF.

    Args:
        file_path: Path to the PDF file.

    Returns:
        The full text content of the PDF.
    """
    import pymupdf

    text_parts: list[str] = []
    with pymupdf.open(file_path) as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "\n".join(text_parts)


def parse_docx(file_path: str) -> str:
    """Extract text from a DOCX file using python-docx.

    Args:
        file_path: Path to the DOCX file.

    Returns:
        The full text content of the document.
    """
    from docx import Document

    doc = Document(file_path)
    return "\n".join(paragraph.text for paragraph in doc.paragraphs)


def parse_txt(file_path: str) -> str:
    """Read text from a plain text file.

    Args:
        file_path: Path to the TXT file.

    Returns:
        The full text content of the file.
    """
    return Path(file_path).read_text(encoding="utf-8")


def parse_document(file_path: str) -> str:
    """Parse a document by dispatching to the appropriate parser based on file extension.

    Supported extensions: .pdf, .docx, .txt

    Args:
        file_path: Path to the document file.

    Returns:
        The full text content of the document.

    Raises:
        ValueError: If the file extension is not supported.
    """
    ext = Path(file_path).suffix.lower()

    parsers = {
        ".pdf": parse_pdf,
        ".docx": parse_docx,
        ".txt": parse_txt,
    }

    parser = parsers.get(ext)
    if parser is None:
        supported = ", ".join(sorted(parsers.keys()))
        raise ValueError(f"Unsupported file extension '{ext}'. Supported: {supported}")

    return parser(file_path)
