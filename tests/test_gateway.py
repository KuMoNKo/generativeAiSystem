import unittest
import requests
import os
import json
import time

# Cargar API_KEY desde .env
with open(".env", "r") as f:
    env_vars = dict(line.strip().split("=", 1) for line in f if "=" in line and not line.startswith("#"))

GATEWAY_URL = "http://localhost:8080"
API_KEY = env_vars.get("API_KEY")

class TestAPIGateway(unittest.TestCase):
    def setUp(self):
        self.headers = {"x-api-key": API_KEY}

    def test_health_check(self):
        # El gateway no tiene un /health explícito pero podemos probar /api/tags (proxy)
        response = requests.get(f"{GATEWAY_URL}/api/tags", headers=self.headers)
        self.assertEqual(response.status_code, 200)

    def test_text_gen(self):
        payload = {"prompt": "Say 'hello gateway'", "model": "llama3.2"}
        response = requests.post(f"{GATEWAY_URL}/text/gen", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("response", response.json())

    def test_text_expand(self):
        payload = {"text": "A dark castle", "context": "Cyberpunk"}
        response = requests.post(f"{GATEWAY_URL}/text/expand", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("expanded", response.json())

    def test_visual_optimize_prompt(self):
        payload = {"idea": "A magic forest", "target": "image"}
        response = requests.post(f"{GATEWAY_URL}/visual/optimize-prompt", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("optimized_prompt", response.json())

    def test_agent_character(self):
        payload = {"description": "A steampunk pilot"}
        response = requests.post(f"{GATEWAY_URL}/agent/character", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("character", data)
        self.assertIn("image_prompt_id", data)

    def test_text_continue(self):
        payload = {"text": "Once upon a time in a digital world,"}
        response = requests.post(f"{GATEWAY_URL}/text/continue", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("continuation", response.json())

    def test_image_gen(self):
        payload = {"prompt": "A futuristic city"}
        response = requests.post(f"{GATEWAY_URL}/image/gen", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("prompt_id", response.json())

    def test_image_edit(self):
        payload = {"image_name": "genericElf.png", "prompt": "A realistic night elf"}
        response = requests.post(f"{GATEWAY_URL}/image/edit", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("prompt_id", response.json())

    def test_video_gen(self):
        payload = {"prompt": "A waterfall in a jungle"}
        response = requests.post(f"{GATEWAY_URL}/video/gen", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("prompt_id", response.json())

    def test_unauthorized(self):
        response = requests.get(f"{GATEWAY_URL}/api/tags", headers={"x-api-key": "wrong_key"})
        self.assertEqual(response.status_code, 401)

if __name__ == "__main__":
    unittest.main()
