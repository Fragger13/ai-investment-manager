from app.core.config import settings


class CeleryPlaceholder:
    broker_url = settings.redis_url
    result_backend = settings.redis_url


celery_app = CeleryPlaceholder()
