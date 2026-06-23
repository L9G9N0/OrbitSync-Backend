import os
import sys
import time
import logging
import requests
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.expanduser('~/.blackhole_sync.log'))
    ]
)
logger = logging.getLogger('SyncDaemon')

# Load environment variables from .env if present
def load_env():
    for path in ['.env', '../.env', '../../.env']:
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith('#'):
                            continue
                        if '=' in line:
                            k, v = line.split('=', 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if k not in os.environ:
                                os.environ[k] = v
                logger.info(f"Loaded environment configurations from: '{path}'")
                break
            except Exception as e:
                logger.warning(f"Failed to read .env from '{path}': {e}")

load_env()

# Resolved target endpoint URL and credentials
API_URL = os.getenv('BLACKHOLE_API_URL', 'http://127.0.0.1:8000/upload/')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
USER_EMAIL = os.getenv('BLACKHOLE_USER_EMAIL')
USER_PASSWORD = os.getenv('BLACKHOLE_USER_PASSWORD')

class SupabaseSessionManager:
    """Manages Supabase user login session and handles token renewal."""

    def __init__(self):
        self.access_token = None
        self.expires_at = 0

    def login(self) -> bool:
        if not SUPABASE_URL or not SUPABASE_KEY or not USER_EMAIL or not USER_PASSWORD:
            logger.warning("Supabase authentication credentials (SUPABASE_URL, SUPABASE_KEY, BLACKHOLE_USER_EMAIL, BLACKHOLE_USER_PASSWORD) not fully configured in environment. Attempting anonymous requests.")
            return False

        try:
            url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password"
            headers = {
                "apikey": SUPABASE_KEY,
                "Content-Type": "application/json"
            }
            body = {
                "email": USER_EMAIL,
                "password": USER_PASSWORD
            }
            response = requests.post(url, json=body, headers=headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                expires_in = data.get("expires_in", 3600)
                self.expires_at = time.time() + expires_in - 60  # Refresh 1 minute early
                logger.info(f"Supabase login successful for user: '{USER_EMAIL}'")
                return True
            else:
                logger.error(f"Supabase login failed: Status {response.status_code}. Response: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Exception during Supabase login: {e}")
            return False

    def get_auth_headers(self) -> dict:
        # If token is missing or expired, attempt to re-login
        if not self.access_token or time.time() > self.expires_at:
            self.login()

        headers = {}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

session_manager = SupabaseSessionManager()

class SyncHandler(FileSystemEventHandler):
    def __init__(self, watch_dir: str):
        self.watch_dir = watch_dir

    def on_created(self, event):
        if event.is_directory:
            return
        self.process_file(event.src_path)

    def on_moved(self, event):
        if event.is_directory:
            return
        self.process_file(event.dest_path)

    def process_file(self, filepath: str):
        filename = os.path.basename(filepath)
        
        # 1. Ignore hidden files (e.g. .DS_Store, .git)
        if filename.startswith('.'):
            logger.debug(f"Ignoring hidden file: {filename}")
            return
            
        # 2. Ignore temporary browser downloads
        if filename.endswith('.tmp') or filename.endswith('.crdownload') or filename.endswith('.part'):
            logger.debug(f"Ignoring temporary download file: {filename}")
            return

        # 3. Ensure file write is finished by checking size changes
        try:
            initial_size = os.path.getsize(filepath)
            time.sleep(0.5)
            while os.path.getsize(filepath) != initial_size:
                initial_size = os.path.getsize(filepath)
                time.sleep(0.5)
        except OSError:
            # File might be deleted or locked
            return

        logger.info(f"New file write complete: {filename}. Dispatching upload request...")
        self.upload_file(filepath, filename)

    def upload_file(self, filepath: str, filename: str):
        try:
            headers = session_manager.get_auth_headers()
            with open(filepath, 'rb') as f:
                files = {'file': (filename, f)}
                response = requests.post(API_URL, files=files, headers=headers, timeout=120)
                
            # Self-healing retry: if the server returns 401 Unauthorized, refresh the token and retry immediately
            if response.status_code == 401:
                logger.warning("Upload request returned 401 Unauthorized. Retrying after re-authenticating...")
                if session_manager.login():
                    headers = session_manager.get_auth_headers()
                    with open(filepath, 'rb') as f:
                        files = {'file': (filename, f)}
                        response = requests.post(API_URL, files=files, headers=headers, timeout=120)

            if response.status_code == 200:
                logger.info(f"Successfully synced: {filename}")
            else:
                logger.error(f"Upload failed for {filename}. API Status Code: {response.status_code}. Response: {response.text}")
        except Exception as e:
            logger.error(f"Network error connecting to upload endpoint: {str(e)}")

def main():
    watch_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/BlackHole_Sync'))
    
    if not os.path.exists(watch_dir):
        logger.info(f"Creating monitor watch directory: {watch_dir}")
        os.makedirs(watch_dir, exist_ok=True)

    logger.info(f"BlackHole sync daemon initialized. Monitoring: {watch_dir}")
    logger.info(f"Target API Endpoint: {API_URL}")

    # Establish initial session connection on daemon launch
    session_manager.login()

    event_handler = SyncHandler(watch_dir)
    observer = Observer()
    observer.schedule(event_handler, path=watch_dir, recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Daemon execution terminated by terminal interrupt.")
        observer.stop()
    observer.join()

if __name__ == '__main__':
    main()
