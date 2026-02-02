const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.GATEWAY_PORT || 8080;
const API_KEY = process.env.API_KEY || 'local_dev_key';

const OLLAMA_URL = process.env.OLLAMA_INTERNAL_URL || 'http://ollama:11434';
const COMFYUI_URL = process.env.COMFYUI_INTERNAL_URL || 'http://imagegen:8188';

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === API_KEY) {
        next();
    } else {
        console.log(`Unauthorized access attempt with key: ${apiKey}`);
        res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
};

// --- PROXY ENDPOINTS ---

app.all(['/api/generate', '/api/chat', '/api/tags'], authenticate, async (req, res) => {
    try {
        const isStream = req.body && typeof req.body === 'object' && req.body.stream === true;
        
        const config = {
            method: req.method,
            url: `${OLLAMA_URL}${req.path}`,
            params: req.query,
            responseType: isStream ? 'stream' : 'json'
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            config.data = req.body;
        }

        const response = await axios(config);

        if (isStream) {
            response.data.pipe(res);
        } else {
            res.status(response.status).json(response.data);
        }
    } catch (error) {
        console.error('Ollama Proxy Error:', error.message);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Ollama service unreachable', message: error.message });
        }
    }
});

app.all(['/prompt', '/history', '/history/:id', '/view', '/upload/image'], authenticate, async (req, res) => {
    try {
        const config = {
            method: req.method,
            url: `${COMFYUI_URL}${req.path}`,
            params: req.query
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            config.data = req.body;
        }

        if (req.path === '/upload/image') {
            res.status(501).json({ error: 'Upload proxy not implemented' });
            return;
        }

        const response = await axios(config);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('ComfyUI Proxy Error:', error.message);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'ComfyUI service unreachable', message: error.message });
        }
    }
});

// --- INDIVIDUAL ENDPOINTS ---

app.post('/text/gen', authenticate, async (req, res) => {
    try {
        const { prompt, model = 'llama3.2' } = req.body;
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, { model, prompt, stream: false });
        res.json({ response: response.data.response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/text/expand', authenticate, async (req, res) => {
    try {
        const { text, context = 'General' } = req.body;
        const prompt = `Expand the following text within a ${context} context: "${text}"`;
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, { model: 'llama3.2', prompt, stream: false });
        res.json({ expanded: response.data.response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/visual/optimize-prompt', authenticate, async (req, res) => {
    try {
        const { idea, target = 'image' } = req.body;
        const prompt = `High-quality Stable Diffusion prompt for ${target}: "${idea}"`;
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, { model: 'llama3.2', prompt, stream: false });
        res.json({ optimized_prompt: response.data.response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/agent/character', authenticate, async (req, res) => {
    try {
        const { description } = req.body;
        console.log(`Generating character for: ${description}`);
        const dataPrompt = `Generate a character based on: "${description}". 
        Output ONLY a JSON object with these keys: "name", "history", "appearance", "skills" (array), "visual_prompt".`;
        
        const dataResponse = await axios.post(`${OLLAMA_URL}/api/generate`, { 
            model: 'llama3.2', 
            prompt: dataPrompt, 
            format: 'json', 
            stream: false 
        });
        
        console.log('LLM Response:', dataResponse.data.response);
        
        let characterData;
        try {
            characterData = JSON.parse(dataResponse.data.response);
        } catch (e) {
            console.error('JSON Parse Error:', e.message);
            return res.status(500).json({ error: 'Invalid JSON from LLM', raw: dataResponse.data.response });
        }

        const workflow = {
            "3": { "class_type": "KSampler", "inputs": { "cfg": 8, "denoise": 1, "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "euler", "scheduler": "normal", "seed": 42, "steps": 20, "latent_image": ["5", 0] } },
            "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "juggernautXL_v9.safetensors" } },
            "5": { "class_type": "EmptyLatentImage", "inputs": { "batch_size": 1, "height": 512, "width": 512 } },
            "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": characterData.visual_prompt || "character portrait" } },
            "7": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": "low quality, blurry" } },
            "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
            "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "char", "images": ["8", 0] } }
        };

        const imageResponse = await axios.post(`${COMFYUI_URL}/prompt`, { prompt: workflow });
        res.json({ character: characterData, image_prompt_id: imageResponse.data.prompt_id });
    } catch (error) {
        console.error('Agent Character ORCHESTRATION Error:', error.message);
        if (error.response) console.error('Error Data:', error.response.data);
        res.status(500).json({ error: error.message });
    }
});

app.post('/text/continue', authenticate, async (req, res) => {
    try {
        const { text } = req.body;
        const prompt = `Continue the following story or text naturally: "${text}"`;
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, { model: 'llama3.2', prompt, stream: false });
        res.json({ continuation: response.data.response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/image/gen', authenticate, async (req, res) => {
    try {
        const { prompt, negative_prompt = "blurry, low quality" } = req.body;
        const workflow = {
            "3": { "class_type": "KSampler", "inputs": { "cfg": 8, "denoise": 1, "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "euler", "scheduler": "normal", "seed": Math.floor(Math.random() * 1000000), "steps": 20, "latent_image": ["5", 0] } },
            "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "juggernautXL_v9.safetensors" } },
            "5": { "class_type": "EmptyLatentImage", "inputs": { "batch_size": 1, "height": 512, "width": 512 } },
            "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": prompt } },
            "7": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": negative_prompt } },
            "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
            "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "gen", "images": ["8", 0] } }
        };
        const response = await axios.post(`${COMFYUI_URL}/prompt`, { prompt: workflow });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/image/edit', authenticate, async (req, res) => {
    try {
        const { image_name, prompt, denoise = 0.6 } = req.body;
        const workflow = {
            "10": { "class_type": "LoadImage", "inputs": { "image": image_name } },
            "11": { "class_type": "VAEEncode", "inputs": { "pixels": ["10", 0], "vae": ["4", 2] } },
            "3": { "class_type": "KSampler", "inputs": { "cfg": 8, "denoise": denoise, "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "euler", "scheduler": "normal", "seed": 42, "steps": 20, "latent_image": ["11", 0] } },
            "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "juggernautXL_v9.safetensors" } },
            "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": prompt } },
            "7": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": "low quality" } },
            "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
            "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "edit", "images": ["8", 0] } }
        };
        const response = await axios.post(`${COMFYUI_URL}/prompt`, { prompt: workflow });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/video/gen', authenticate, async (req, res) => {
    try {
        const { prompt, frames = 16 } = req.body;
        const workflow = {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}},
            "2": {"class_type": "EmptyLatentImage", "inputs": {"batch_size": frames, "height": 512, "width": 512}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": prompt}},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": "low quality, static"}},
            "5": {"class_type": "ADE_AnimateDiffLoaderWithContext", "inputs": {"model_name": "mm_sd_v15_v2.ckpt", "beta_schedule": "sqrt_linear (AnimateDiff)", "model": ["1", 0], "context_options": ["6", 0]}},
            "6": {"class_type": "ADE_AnimateDiffUniformContextOptions", "inputs": {"context_length": 16, "context_stride": 1, "context_overlap": 4, "closed_loop": false, "context_schedule": "uniform"}},
            "7": {"class_type": "KSampler", "inputs": {"cfg": 8, "denoise": 1, "latent_image": ["2", 0], "model": ["5", 0], "negative": ["4", 0], "positive": ["3", 0], "sampler_name": "euler", "scheduler": "normal", "seed": 42, "steps": 15}},
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
            "9": {"class_type": "VHS_VideoCombine", "inputs": {"images": ["8", 0], "format": "video/h264-mp4", "filename_prefix": "video", "fps": 8, "frame_rate": 8, "loop_count": 0, "save_output": true, "pingpong": false}}
        };
        const response = await axios.post(`${COMFYUI_URL}/prompt`, { prompt: workflow });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
