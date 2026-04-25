from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from database import AdminAuditLog


def log_admin_action(
    db: Session,
    actor_user_id: int,
    action: str,
    target_type: str,
    target_id: str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    row = AdminAuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=json.dumps(detail, ensure_ascii=False) if detail else None,
    )
    db.add(row)
    db.commit()
