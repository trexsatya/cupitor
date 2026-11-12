import importlib.util
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('download_audio', Path(__file__).with_name('download-audio.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        redirects = {
            '/redirect': '/audio?token=example',
            '/redirect-with-header': '/audio-with-header',
            '/redirect-to-filename': '/Kropp%20och%20sj%C3%A4l.m4a?token=example',
        }
        if self.path in redirects:
            self.send_response(302)
            self.send_header('Location', redirects[self.path])
            self.send_header('Content-Disposition', 'attachment; filename="redirect.mp3"')
            self.end_headers()
            return
        self.send_response(404 if self.path == '/missing' else 200)
        if self.path == '/audio-with-header':
            self.send_header('Content-Disposition',
                             "attachment; filename=ascii.mp3; filename*=UTF-8''Kropp%20och%20sj%C3%A4l.mp3")
        if self.path == '/audio-with-path':
            self.send_header('Content-Disposition', 'attachment; filename="../../Kropp och själ.mp3"')
        self.end_headers()
        if self.path.startswith(('/audio', '/Kropp%20och%20sj%C3%A4l.m4a')):
            self.wfile.write(b'ID3\x04\x00\x00test-audio')
        elif self.path == '/html':
            self.wfile.write(b'\xef\xbb\xbf \n<!DOCTYPE html><html>Preview</html>')

    def log_message(self, *args):
        pass


class DownloadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / 'audio.mp3'

    def test_direct_url_and_redirect_preserve_bytes(self):
        for suffix in ('/audio?token=example', '/redirect', '/audio-with-header'):
            module.download_audio(self.base + suffix, self.output)
            self.assertEqual(self.output.read_bytes(), b'ID3\x04\x00\x00test-audio')

    def test_direct_source_filename_uses_final_header_then_url_then_fallback(self):
        cases = (
            ('/redirect-with-header', 'Kropp och själ.mp3'),
            ('/redirect-to-filename', 'Kropp och själ.m4a'),
            ('/redirect', 'audio.mp3'),
            ('/audio-with-path', 'Kropp och själ.mp3'),
        )
        for suffix, expected_name in cases:
            with self.subTest(suffix=suffix):
                output = module.download_audio(self.base + suffix, self.output, use_source_filename=True)
                self.assertEqual(output, self.output.with_name(expected_name))
                self.assertEqual(output.read_bytes(), b'ID3\x04\x00\x00test-audio')

    def test_invalid_download_does_not_replace_existing_audio(self):
        self.output.write_bytes(b'previous audio')
        for suffix in ('/html', '/empty', '/missing'):
            with self.subTest(suffix=suffix), self.assertRaises((ValueError, module.subprocess.CalledProcessError)):
                module.download_audio(self.base + suffix, self.output)
            self.assertEqual(self.output.read_bytes(), b'previous audio')
            self.assertFalse(self.output.with_suffix('.mp3.part').exists())

    def test_drive_share_and_download_links_use_drive_downloader(self):
        def fake_download(**kwargs):
            Path(kwargs['output']).write_bytes(b'ID3audio')
            return kwargs['output']
        for url in ('https://drive.google.com/file/d/example/view?usp=drivesdk',
                    'https://drive.google.com/uc?id=example'):
            with patch('gdown.download', side_effect=fake_download) as download:
                module.download_audio(url, self.output)
                self.assertEqual(download.call_args.kwargs['url'], url)
                self.assertTrue(download.call_args.kwargs['fuzzy'])
                self.assertEqual(self.output.read_bytes(), b'ID3audio')

    def test_drive_failure_explains_permissions(self):
        with patch('gdown.download', side_effect=RuntimeError('Permission denied')):
            with self.assertRaisesRegex(ValueError, 'Anyone with the link'):
                module.download_audio('https://drive.google.com/file/d/example/view', self.output)
        self.assertFalse(self.output.exists())

    def test_drive_source_filename_uses_the_name_returned_by_gdown(self):
        def fake_download(**kwargs):
            self.assertTrue(kwargs['output'].endswith('/'))
            output = Path(kwargs['output']) / 'Avsnitt 12 – sömn.mp3'
            output.write_bytes(b'ID3audio')
            return str(output)

        with patch('gdown.download', side_effect=fake_download):
            output = module.download_audio('https://drive.google.com/file/d/example/view', self.output,
                                           use_source_filename=True)
        self.assertEqual(output, self.output.with_name('Avsnitt 12 – sömn.mp3'))
        self.assertEqual(output.read_bytes(), b'ID3audio')

    def test_reject_non_http_url(self):
        with self.assertRaisesRegex(ValueError, 'HTTP'):
            module.download_audio('file:///tmp/audio.mp3', self.output)


if __name__ == '__main__':
    unittest.main()
