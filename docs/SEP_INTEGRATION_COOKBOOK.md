# Integración SISMO ⇄ SEP — Cookbook

Documento complementario de `docs/SEP_INTEGRATION.md`. Contiene solo lo que está
**implementado y funcional** en el repositorio de SISMO. El resto de la
integración (proxy reverso, verificación HMAC de SEP, despliegue) está
pendiente y no tiene código aplicado todavía.

---

## Partner API (implementada)

`apps/api/app/api/v1/partner.py`, registrada en `app/api/v1/router.py`. SEP la
consulta server-to-server con `Authorization: Bearer <SISMO_SEP_API_TOKEN>`.

```python
from fastapi import APIRouter, Depends, Header
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.db.base import get_db
from app.db.models import Notification, User

router = APIRouter(prefix="/partner/v1", tags=["partner"])


def require_sep_partner_token(
    authorization: str = Header(None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.sep_api_token:
        raise ApiError(ErrorCode.auth_sep_unauthorized, "SEP partner API not configured")
    expected = f"Bearer {settings.sep_api_token}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise ApiError(ErrorCode.auth_sep_token_invalid, "invalid SEP API token")


@router.get("/users/{sep_user_id}/notifications/summary")
def partner_notifications_summary(
    sep_user_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_sep_partner_token),
) -> dict:
    user = db.execute(select(User).where(User.sep_user_id == sep_user_id)).scalar_one_or_none()
    if not user:
        return {"unread": 0, "items": []}
    unread = db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user.id, Notification.read.is_(False)
        )
    ).scalar() or 0
    notifs = db.execute(
        select(Notification).where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc()).limit(20)
    ).scalars().all()
    return {
        "unread": unread,
        "items": [
            {
                "id": str(n.id), "type": n.type, "title": n.title,
                "message": n.message, "activity_id": str(n.activity_id) if n.activity_id else None,
                "read": n.read, "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifs
        ],
    }
```

---

## Contrato Partner API

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| `GET` | `/partner/v1/users/{sep_user_id}/notifications/summary` | `Bearer <SISMO_SEP_API_TOKEN>` | `{ "unread": int, "items": [...] }` |
| `GET` | `/partner/v1/users/{sep_user_id}/notifications` | `Bearer <SISMO_SEP_API_TOKEN>` | `[ { id, type, title, message, activity_id, read, created_at } ]` |

- Errores: `401 auth.sep_token_invalid` (token ausente/inválido), `404` si el
  `sep_user_id` no existe en SISMO (la app devuelve `{unread:0,items:[]}` para
  no romper el header).
- `sep_user_id` es el identificador estable de SEP del usuario.
