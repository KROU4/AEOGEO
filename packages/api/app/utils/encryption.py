"""Fernet symmetric encryption for storing API keys at rest."""

from cryptography.fernet import Fernet

from app.config import Settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        settings = Settings()
        if not settings.encryption_key:
            raise RuntimeError(
                "ENCRYPTION_KEY is not set. "
                "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )
        _fernet = Fernet(settings.encryption_key.encode())
    return _fernet


def encrypt_value(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()
