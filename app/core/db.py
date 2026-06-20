from app.core.config import settings

_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL.strip().rstrip('/')
    key = settings.SUPABASE_KEY

    # Check for placeholder or empty/missing values
    if not url or "placeholder" in url.lower() or url == "https://placeholder-project.supabase.co":
        raise ValueError("SUPABASE_URL is not configured or contains a placeholder value.")
    if not key or "placeholder" in key.lower() or key == "placeholder-anon-key":
        raise ValueError("SUPABASE_KEY is not configured or contains a placeholder value.")

    # Defensive normalization: strip trailing PostgREST REST suffix if accidentally supplied
    for suffix in ("/rest/v1", "/rest/v1/"):
        if url.endswith(suffix):
            url = url[:-len(suffix)].rstrip('/')
            break

    if not url.startswith("http://") and not url.startswith("https://"):
        raise ValueError("SUPABASE_URL must start with http:// or https://")

    from supabase import create_client
    _supabase_client = create_client(url, key)
    return _supabase_client

class SupabaseProxy:
    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(f"SupabaseProxy has no private or magic attribute '{name}'")
        client = get_supabase_client()
        return getattr(client, name)

supabase = SupabaseProxy()