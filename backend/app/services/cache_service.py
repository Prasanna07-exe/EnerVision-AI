import json
import logging
from typing import Optional, Any
import redis
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Redis connection
redis_client = None
try:
    if settings.REDIS_URL:
        # Pings Redis to verify connection is alive
        redis_client = redis.from_url(settings.REDIS_URL, socket_timeout=2.0)
        redis_client.ping()
        logger.info("Successfully connected to Redis container cache.")
except Exception as e:
    logger.warning(f"Redis container cache not available. Falling back to local in-memory cache. Info: {e}")
    redis_client = None

# Fallback local dictionary for caching
_memory_cache = {}

class CacheService:
    @staticmethod
    def get(key: str) -> Optional[Any]:
        """Retrieves a cached value from Redis or Memory."""
        if redis_client:
            try:
                val = redis_client.get(key)
                if val:
                    return json.loads(val)
            except Exception as e:
                logger.error(f"Redis read error: {e}")
        return _memory_cache.get(key)

    @staticmethod
    def set(key: str, value: Any, ttl: int = 3600):
        """Caches a value with a Time-To-Live (TTL) parameter in seconds."""
        if redis_client:
            try:
                redis_client.setex(key, ttl, json.dumps(value))
                return
            except Exception as e:
                logger.error(f"Redis write error: {e}")
        _memory_cache[key] = value

    @staticmethod
    def delete(key: str):
        """Clears a key from the cache registry."""
        if redis_client:
            try:
                redis_client.delete(key)
                return
            except Exception as e:
                logger.error(f"Redis delete error: {e}")
        _memory_cache.pop(key, None)
