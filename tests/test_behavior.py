import unittest
import requests
import os
import time
import json

# Cargar configuración básica
OLLAMA_URL = "http://localhost:11000"
IMAGEGEN_URL = "http://localhost:11002"

class TestGenerativeAIPlatform(unittest.TestCase):

    # --- OLLAMA TESTS ---
    
    def test_ollama_tags(self):
        """Verifica que Ollama esté respondiendo y devuelva modelos locales."""
        try:
            response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            self.assertEqual(response.status_code, 200)
            self.assertIn("models", response.json())
        except requests.exceptions.ConnectionError:
            self.fail(f"Ollama no está disponible en {OLLAMA_URL}")

    def test_ollama_generate_no_stream(self):
        """Prueba una generación básica (sin streaming) en Ollama."""
        # Nota: Asumimos que hay al menos un modelo descargado. 
        # Si falla, es posible que se necesite hacer 'ollama pull' de un modelo base.
        payload = {
            "model": "llama3.2", # Usando llama3.2 según lo solicitado
            "prompt": "Say 'ok'",
            "stream": False
        }
        try:
            response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=30)
            if response.status_code == 404:
                self.skipTest("Modelo 'llama3.2' no encontrado en Ollama.")
            self.assertEqual(response.status_code, 200)
            self.assertIn("response", response.json())
        except requests.exceptions.ConnectionError:
            self.fail("Ollama no disponible.")

    # --- IMAGEGEN (COMFYUI) TESTS ---

    def _wait_for_prompt_completion(self, prompt_id, timeout=300):
        """Espera a que un prompt se procese en ComfyUI."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            response = requests.get(f"{IMAGEGEN_URL}/history/{prompt_id}")
            if response.status_code == 200:
                history = response.json()
                if prompt_id in history:
                    return history[prompt_id]
            time.sleep(2)
        self.fail(f"Timeout esperando al prompt {prompt_id}")

    def test_imagegen_txt2img(self):
        """Prueba la creación de una imagen desde cero (txt2img)."""
        workflow = {
            "3": {
                "class_type": "KSampler",
                "inputs": {
                    "cfg": 8,
                    "denoise": 1,
                    "latent_image": ["5", 0],
                    "model": ["4", 0],
                    "negative": ["7", 0],
                    "positive": ["6", 0],
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "seed": 42,
                    "steps": 20
                }
            },
            "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "juggernautXL_v9.safetensors"}},
            "5": {"class_type": "EmptyLatentImage", "inputs": {"batch_size": 1, "height": 512, "width": 512}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "a beautiful forest landscape, high quality"}},
            "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "text, watermark, blurry"}},
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
            "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "test_txt2img", "images": ["8", 0]}}
        }

        payload = {"prompt": workflow}
        try:
            response = requests.post(f"{IMAGEGEN_URL}/prompt", json=payload)
            self.assertEqual(response.status_code, 200, f"Error al enviar prompt: {response.text}")
            prompt_id = response.json()["prompt_id"]
            
            result = self._wait_for_prompt_completion(prompt_id)
            self.assertIn("outputs", result)
        except requests.exceptions.ConnectionError:
            self.fail("Imagegen no disponible.")

    def test_imagegen_img2img(self):
        """Prueba la edición de una imagen existente (img2img) usando genericElf.png."""
        workflow = {
            "10": {"class_type": "LoadImage", "inputs": {"image": "genericElf.png"}},
            "11": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["4", 2]}},
            "3": {
                "class_type": "KSampler",
                "inputs": {
                    "cfg": 8,
                    "denoise": 0.6,
                    "latent_image": ["11", 0],
                    "model": ["4", 0],
                    "negative": ["7", 0],
                    "positive": ["6", 0],
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "seed": 42,
                    "steps": 20
                }
            },
            "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "juggernautXL_v9.safetensors"}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "realistic night elf, world of warcraft style, detailed"}},
            "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "text, watermark, blurry"}},
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
            "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "test_img2img", "images": ["8", 0]}}
        }

        payload = {"prompt": workflow}
        try:
            response = requests.post(f"{IMAGEGEN_URL}/prompt", json=payload)
            self.assertEqual(response.status_code, 200, f"Error al enviar prompt: {response.text}")
            prompt_id = response.json()["prompt_id"]
            
            
            result = self._wait_for_prompt_completion(prompt_id)
            self.assertIn("outputs", result)
        except requests.exceptions.ConnectionError:
            self.fail("Imagegen no disponible.")

    def test_imagegen_videogen_animatediff(self):
        """Prueba la generación de video usando AnimateDiff."""
        workflow = {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}},
            "2": {"class_type": "EmptyLatentImage", "inputs": {"batch_size": 8, "height": 512, "width": 512}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": "a cute cat dancing, high quality, animated"}},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": "blurry, low quality, static"}},
            "5": {
                "class_type": "ADE_AnimateDiffLoaderWithContext",
                "inputs": {
                    "model_name": "mm_sd_v15_v2.ckpt",
                    "beta_schedule": "sqrt_linear (AnimateDiff)",
                    "model": ["1", 0],
                    "context_options": ["6", 0]
                }
            },
            "6": {
                "class_type": "ADE_AnimateDiffUniformContextOptions", 
                "inputs": {
                    "context_length": 16, 
                    "context_stride": 1, 
                    "context_overlap": 4,
                    "closed_loop": False,
                    "context_schedule": "uniform"
                }
            },
            "7": {
                "class_type": "KSampler",
                "inputs": {
                    "cfg": 8,
                    "denoise": 1,
                    "latent_image": ["2", 0],
                    "model": ["5", 0],
                    "negative": ["4", 0],
                    "positive": ["3", 0],
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "seed": 42,
                    "steps": 15
                }
            },
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
            "9": {
                "class_type": "VHS_VideoCombine",
                "inputs": {
                    "images": ["8", 0],
                    "format": "video/h264-mp4",
                    "filename_prefix": "test_animatediff",
                    "fps": 8,
                    "frame_rate": 8,
                    "loop_count": 0,
                    "save_output": True,
                    "pingpong": False
                }
            }
        }

        payload = {"prompt": workflow}
        try:
            # Esperar un poco a que los nodos carguen si el contenedor acaba de arrancar
            time.sleep(5)
            response = requests.post(f"{IMAGEGEN_URL}/prompt", json=payload)
            self.assertEqual(response.status_code, 200, f"Error al enviar prompt de video: {response.text}")
            prompt_id = response.json()["prompt_id"]
            
            result = self._wait_for_prompt_completion(prompt_id, timeout=600)
            self.assertIn("outputs", result)
        except requests.exceptions.ConnectionError:
            self.fail("Imagegen no disponible para test de video.")

if __name__ == "__main__":
    unittest.main()
