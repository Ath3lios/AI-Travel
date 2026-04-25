from datetime import datetime
from threading import Lock


_lock = Lock()
_stats = {
    "total_requests": 0,
    "failed_requests": 0,
    "last_error_at": None,
}


def record_request(status_code: int) -> None:
    with _lock:
        _stats["total_requests"] += 1
        if status_code >= 500:
            _stats["failed_requests"] += 1
            _stats["last_error_at"] = datetime.utcnow().isoformat()


def snapshot() -> dict:
    with _lock:
        return dict(_stats)
