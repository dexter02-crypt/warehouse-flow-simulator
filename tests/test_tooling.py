from __future__ import annotations
import contextlib
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import serve
import publish
from tools import check


class RunnerTests(unittest.TestCase):
    def test_command_contains_explicit_sorted_files_not_globs(self):
        with tempfile.TemporaryDirectory(prefix='runner path ') as d:
            root = Path(d); (root / 'tests').mkdir()
            for name in ['z.test.mjs', 'a.test.mjs']:
                (root / 'tests' / name).write_text('')
            self.assertEqual(check.node_test_command(root), ['node', '--test', '--test-reporter=tap', 'tests/a.test.mjs', 'tests/z.test.mjs'])

    def test_missing_tests_are_not_an_empty_success(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertRaises(ValueError, check.node_test_command, Path(d))

    def test_symlink_test_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root / 'tests').mkdir(); (root / 'source.mjs').write_text('')
            (root / 'tests' / 'one.test.mjs').symlink_to(root / 'source.mjs')
            self.assertRaises(ValueError, check.node_test_command, root)

    def test_directory_is_not_a_test_file(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root / 'tests' / 'folder.test.mjs').mkdir(parents=True)
            self.assertRaises(ValueError, check.node_test_command, root)

    def test_real_failing_node_test_returns_failure(self):
        with tempfile.TemporaryDirectory(prefix='sentinel path ') as d:
            root = Path(d); (root / 'tests').mkdir()
            (root / 'tests' / 'fail.test.mjs').write_text('throw Error("intentional sentinel failure");\n')
            real = subprocess.run
            def capture(*args, **kwargs):
                kwargs.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                return real(*args, **kwargs)
            with patch.object(check.subprocess, 'run', side_effect=capture) as spy:
                self.assertRaises(subprocess.CalledProcessError, check.run_node_tests, root)
            self.assertFalse(spy.call_args.kwargs['shell'])
            self.assertEqual(spy.call_args.kwargs['stdin'], subprocess.DEVNULL)

    def test_real_passing_node_test_runs_to_completion(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root / 'tests').mkdir()
            (root / 'tests' / 'pass.test.mjs').write_text('import test from "node:test";test("actual pass",()=>{});\n')
            real = subprocess.run; outputs = []
            def capture(*args, **kwargs):
                kwargs.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                r = real(*args, **kwargs); outputs.append(r.stdout); return r
            with patch.object(check.subprocess, 'run', side_effect=capture):
                check.run_node_tests(root)
            self.assertIn('# tests 1', outputs[0])
            self.assertIn('# pass 1', outputs[0])

    def test_node_preloads_are_removed_from_test_environment(self):
        with patch.dict(os.environ, {'NODE_OPTIONS': '--require /fake', 'NODE_PATH': '/fake'}):
            env = check.clean_environment()
        self.assertNotIn('NODE_OPTIONS', env); self.assertNotIn('NODE_PATH', env)

    def test_obsolete_public_mode_cannot_call_git_or_github(self):
        with patch.object(publish.subprocess, 'run') as spy, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(publish.main(['--public']), 2)
        spy.assert_not_called()

    def test_publisher_test_mode_propagates_failure(self):
        with patch.object(publish, 'run_checks', side_effect=subprocess.CalledProcessError(1, ['node'])), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(publish.main(['--test']), 1)

    def test_publisher_inventory_has_no_network_calls(self):
        with patch.object(publish, 'verify_integrity', return_value={'a': 'hash'}), patch.object(publish.subprocess, 'run') as spy, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(publish.main([]), 0)
        spy.assert_not_called()


class IntegrityTests(unittest.TestCase):
    def prepare(self, root):
        (root / 'a.txt').write_text('original')
        data = {'a.txt': hashlib.sha256(b'original').hexdigest()}
        (root / 'INTEGRITY.json').write_text(json.dumps(data))
        return data

    def test_correct_payload_verified(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); data = self.prepare(root)
            self.assertEqual(check.verify_integrity(root), data)

    def test_changed_payload_refused(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); self.prepare(root); (root / 'a.txt').write_text('changed')
            self.assertRaises(ValueError, check.verify_integrity, root)

    def test_missing_payload_refused(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); self.prepare(root); (root / 'a.txt').unlink()
            self.assertRaises(ValueError, check.verify_integrity, root)

    def test_symlink_payload_refused_even_for_identical_bytes(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); self.prepare(root); (root / 'a.txt').rename(root / 'outside.txt')
            (root / 'a.txt').symlink_to(root / 'outside.txt')
            self.assertRaises(ValueError, check.verify_integrity, root)

    def test_parent_traversal_record_refused(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root / 'INTEGRITY.json').write_text(json.dumps({'../elsewhere': '0' * 64}))
            self.assertRaises(ValueError, check.verify_integrity, root)


    def test_unlisted_test_file_refused_before_execution(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); self.prepare(root); (root / 'tests').mkdir()
            (root / 'tests' / 'extra.test.mjs').write_text('throw Error("unlisted");')
            self.assertRaisesRegex(ValueError, 'Unlisted', check.verify_integrity, root)

    def test_invalid_hash_type_is_a_validation_error(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root / 'INTEGRITY.json').write_text(json.dumps({'a.txt': []}))
            self.assertRaises(ValueError, check.verify_integrity, root)


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        (self.root / 'index.html').write_text('<!doctype html><html>fixture</html>')
        (self.root / 'src').mkdir(); (self.root / 'src/app.js').write_text('export const fixture=1;')
        (self.root / 'ASSETS.json').write_text(json.dumps(['index.html', 'src/app.js']))
        (self.root / '.git').mkdir(); (self.root / '.git/config').write_text('fake private repository metadata')
        (self.root / '.env').write_text('FAKE_SECRET=not-for-serving')
        self.server = serve.make_server(self.root)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True); self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=2); self.temp.cleanup()

    def request(self, path, method='GET', headers=None):
        c = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        c.request(method, path, headers=headers or {}); r = c.getresponse(); body = r.read()
        status, hdrs = r.status, dict(r.getheaders()); c.close(); return status, hdrs, body

    def test_whitelisted_index_is_served(self):
        status, headers, body = self.request('/')
        self.assertEqual(status, 200); self.assertIn(b'fixture', body); self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')

    def test_whitelisted_js_has_javascript_mime(self):
        status, headers, _ = self.request('/src/app.js')
        self.assertEqual(status, 200); self.assertIn('javascript', headers['Content-Type'])

    def test_head_has_no_body(self):
        status, headers, body = self.request('/', 'HEAD')
        self.assertEqual(status, 200); self.assertEqual(body, b''); self.assertGreater(int(headers['Content-Length']), 0)

    def test_git_metadata_is_not_served(self):
        self.assertEqual(self.request('/.git/config')[0], 404)

    def test_personal_file_is_not_served(self):
        self.assertEqual(self.request('/.env')[0], 404)

    def test_directory_listing_is_not_served(self):
        self.assertEqual(self.request('/src/')[0], 404)

    def test_encoded_traversal_is_not_served(self):
        self.assertEqual(self.request('/src/%2e%2e/.git/config')[0], 404)

    def test_host_header_is_checked(self):
        self.assertEqual(self.request('/', headers={'Host': 'unrelated.example'})[0], 403)

    def test_foreign_origin_is_rejected(self):
        self.assertEqual(self.request('/', headers={'Origin': 'https://unrelated.example'})[0], 403)

    def test_favicon_is_an_empty_response_not_a_missing_application(self):
        self.assertEqual(self.request('/favicon.ico')[0], 204)

    def test_symlink_in_asset_path_is_not_followed(self):
        (self.root / 'src/app.js').unlink(); (self.root / 'src/app.js').symlink_to(self.root / '.env')
        self.assertEqual(self.request('/src/app.js')[0], 404)

    def test_parent_symlink_is_not_followed(self):
        (self.root / 'src/app.js').unlink(); (self.root / 'src').rmdir()
        (self.root / 'elsewhere').mkdir(); (self.root / 'elsewhere/app.js').write_text('secret')
        (self.root / 'src').symlink_to(self.root / 'elsewhere', target_is_directory=True)
        self.assertEqual(self.request('/src/app.js')[0], 404)

    def test_post_cannot_write_files(self):
        self.assertEqual(self.request('/index.html', 'POST')[0], 501)
        self.assertIn('fixture', (self.root / 'index.html').read_text())


if __name__ == '__main__':
    unittest.main()
