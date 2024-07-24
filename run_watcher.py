import time
import subprocess
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class SiteChangeHandler(FileSystemEventHandler):
    def __init__(self):
        self.last_run_time = 0
        self.run_interval = 1  # Minimum time interval (in seconds) between runs


    def on_modified(self, event):
        if (event.src_path.endswith('.md') or event.src_path.endswith('.py') or event.src_path.endswith('.html')):
            current_time = time.time()
            if (current_time - self.last_run_time) > self.run_interval:
                print(f'File changed: {event.src_path}')
                self.last_run_time = current_time
                # Run your regeneration command here
                subprocess.run(['python', 'run_generator.py'])

    def on_moved(self, event):
        self.last_run_time = 0  # Reset last run time on file move


    def on_created(self, event):
        self.last_run_time = 0  # Reset last run time on file creation


def start_custom_watching():
    path = '.'  # Watch the current directory and subdirectories
    event_handler = SiteChangeHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()

    print('Watching for changes. Press Ctrl+C to stop.')

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()

    observer.join()
