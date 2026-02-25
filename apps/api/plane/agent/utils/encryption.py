# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import base64
import hashlib

# Third party imports
from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet_key():
    """Derive a Fernet-compatible key from Django's SECRET_KEY.

    Uses SHA-256 to produce a deterministic 32-byte key, then
    base64url-encodes it as required by the Fernet spec.
    """
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(key)


def encrypt_token(token: str) -> str:
    """Encrypt a plaintext token string using Fernet symmetric encryption.

    Returns the ciphertext as a URL-safe base64-encoded string.
    Returns an empty string if the input is empty.
    """
    if not token:
        return ""
    f = Fernet(_get_fernet_key())
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a Fernet-encrypted token back to plaintext.

    Returns an empty string if the input is empty.
    """
    if not encrypted_token:
        return ""
    f = Fernet(_get_fernet_key())
    return f.decrypt(encrypted_token.encode()).decode()
