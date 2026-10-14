"""비밀번호 해시. 원문은 저장하지 않고 솔트가 포함된 argon2id 해시 문자열만 저장한다."""
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()  # argon2id, 솔트는 호출마다 무작위로 만들어 해시 문자열에 포함된다.


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False
