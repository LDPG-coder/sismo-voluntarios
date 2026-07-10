from enum import StrEnum


class UserRole(StrEnum):
    volunteer = "volunteer"
    admin = "admin"


class UserStatus(StrEnum):
    pending = "pending"
    active = "active"
    suspended = "suspended"


class ActivityStatus(StrEnum):
    active = "active"
    cancelled = "cancelled"
    archived = "archived"
