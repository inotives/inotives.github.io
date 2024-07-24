from flask import Flask, send_from_directory
import threading
import run_watcher

app = Flask(__name__, static_folder='docs/assets', static_url_path='/assets')

@app.route('/')
def index():
    return send_from_directory('docs', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    if filename.startswith('assets/'):
        return send_from_directory('docs/assets', filename)
    return send_from_directory('docs', filename)

def run_flask_app():
    app.run(debug=True, port=5050)

if __name__ == "__main__":
    # Start the custom watcher in a separate thread
    watcher_thread = threading.Thread(target=run_watcher.start_custom_watching)
    watcher_thread.start()

    # Start the Flask server
    run_flask_app()
