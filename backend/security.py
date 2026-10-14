"""비밀번호 해시. 원문은 저장하지 않고 솔트가 포함된 argon2id 해시 문자열만 저장한다."""
import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()  # argon2id, 솔트는 호출마다 무작위로 만들어 해시 문자열에 포함된다.


def new_session_token() -> str:
    """예측할 수 없는 세션 토큰(256비트). 원문은 쿠키로만 전달한다."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """DB에는 토큰의 SHA-256 해시(16진수 64자)만 저장한다."""
    return hashlib.sha256(token.encode()).hexdigest()


def hash_username(username: str) -> str:
    """로그인 실패 횟수의 키. 아이디(소문자)의 SHA-256 해시이며 아이디 원문은 저장하지 않는다."""
    return hashlib.sha256(username.lower().encode()).hexdigest()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


# 없는 아이디나 형식이 맞지 않는 값도 같은 비용의 검증을 해서 응답 시간으로 존재 여부를 알 수 없게 한다.
DUMMY_HASH = _hasher.hash("dummy-password-for-timing")
