"""Local-only WebM to MP4 converter for the advertisement preview."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import tempfile, subprocess, json
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.end_headers()
    def do_GET(self):
        if self.path != '/health':
            self.send_error(404); return
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers(); self.wfile.write(b'{"ok":true}')
    def do_POST(self):
        if self.path not in ('/mp4', '/convert'):
            self.send_error(403); return
        size = int(self.headers.get('Content-Length', '0'))
        if not 0 < size < 200_000_000:
            self.send_error(413); return
        with tempfile.TemporaryDirectory(prefix='panel-pro-export-') as directory:
            source = Path(directory)/'recording.webm'
            target = Path(directory)/'advert.mp4'
            source.write_bytes(self.rfile.read(size))
            result = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-i', str(source),
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
                '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(target)],
                capture_output=True, timeout=180)
            if result.returncode:
                self.send_error(500, 'Conversion failed'); return
            data = target.read_bytes()
            output = ROOT/'promo-exports'
            output.mkdir(exist_ok=True)
            import datetime
            (output/('panel-pro-bot-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.mp4')).write_bytes(data)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers(); self.wfile.write(data)

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8770), Handler).serve_forever()
