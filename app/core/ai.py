import json
import time
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

_groq_client = None


def get_groq_client():
    global _groq_client
    if _groq_client is not None:
        return _groq_client

    key = settings.GROQ_API_KEY
    if not key or not key.strip() or "placeholder" in key.lower():
        raise ValueError("GROQ_API_KEY is not configured.")

    from groq import Groq
    _groq_client = Groq(api_key=key)
    return _groq_client


def generate_file_tags(filename: str, max_retries: int = 2) -> dict:
    """Generate semantic tags for a file using Groq LLM with retry logic."""
    prompt = (
        f"You are a file organization AI. Analyze the filename: '{filename}'\n"
        "Generate exactly 3 highly relevant semantic tags.\n"
        "Output ONLY valid JSON — no prose, no markdown.\n"
        'Example: {"tags": ["finance", "quarterly-report", "spreadsheet"]}'
    )

    last_error = None
    for attempt in range(max_retries + 1):
        try:
            client = get_groq_client()
            response = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.1,
                max_tokens=128,
                timeout=15,  # 15 second hard timeout per attempt
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content
            result = json.loads(raw)
            tags = result.get("tags", [])
            if not isinstance(tags, list) or not tags:
                raise ValueError(f"AI returned unexpected structure: {raw}")
            # Sanitize: max 6 tags, each a clean string
            tags = [str(t).strip()[:50] for t in tags[:6] if t]
            logger.info(f"AI tagged '{filename}': {tags}")
            return {"tags": tags}

        except ValueError as e:
            last_error = e
            logger.warning(f"AI tagging parse error (attempt {attempt + 1}): {e}")
        except Exception as e:
            last_error = e
            logger.warning(f"AI tagging error (attempt {attempt + 1}): {e}")
            if attempt < max_retries:
                time.sleep(1.5 * (attempt + 1))  # Exponential backoff

    logger.error(f"AI tagging failed for '{filename}' after {max_retries + 1} attempts: {last_error}")
    return {"tags": ["untagged"]}