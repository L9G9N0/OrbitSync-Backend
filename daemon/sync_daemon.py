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

# Resolved target endpoint URL
API_URL = os.getenv('BLACKHOLE_API_URL', 'http://127.0.0.1:8000/upload/')

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
            with open(filepath, 'rb') as f:
                files = {'file': (filename, f)}
                response = requests.post(API_URL, files=files, timeout=120)
                
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
