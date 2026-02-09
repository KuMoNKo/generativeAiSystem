const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.GATEWAY_PORT || 8080;
const API_KEY = process.env.API_KEY || 'local_dev_key';

const OLLAMA_URL = process.env.OLLAMA_INTERNAL_URL || 'http://ollama:11434';
const COMFYUI_URL = process.env.COMFYUI_INTERNAL_URL || 'http://imagegen:8188';

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const authenticate = (req, res, next) => {
    // Skip authentication for the web UI itself if accessed via browser
    if (req.path === '/' || req.path.endsWith('.html') || req.path.endsWith('.js') || req.path.endsWith('.css')) {
        return next();
    }
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey === API_KEY) {
        next();
    } else {
        console.log(`Unauthorized access attempt with key: ${apiKey}`);
        res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
};

app.use(authenticate);

// --- MODEL MANAGEMENT ---

app.get('/models', async (req, res) => {
    try {
        const ollamaModels = await axios.get(`${OLLAMA_URL}/api/tags`);

        const modelsBase = process.env.IMAGEGEN_MODELS_PATH || '/app/models_imagegen';
        const checkpointsDir = path.join(modelsBase, 'checkpoints');
        const unetDir = path.join(modelsBase, 'unet');
        const clipDir = path.join(modelsBase, 'clip');
        const vaeDir = path.join(modelsBase, 'vae');

        let imageModels = [];
        if (fs.existsSync(checkpointsDir)) {
            imageModels = [...imageModels, ...fs.readdirSync(checkpointsDir).filter(f => f.endsWith('.safetensors') || f.endsWith('.ckpt'))];
        }
        if (fs.existsSync(unetDir)) {
            imageModels = [...imageModels, ...fs.readdirSync(unetDir).filter(f => f.endsWith('.gguf'))];
        }

        let clips = [];
        if (fs.existsSync(clipDir)) {
            clips = fs.readdirSync(clipDir).filter(f => f.endsWith('.safetensors') || f.endsWith('.ckpt') || f.endsWith('.bin') || f.endsWith('.gguf'));
        }

        let vaes = [];
        if (fs.existsSync(vaeDir)) {
            vaes = fs.readdirSync(vaeDir).filter(f => f.endsWith('.safetensors') || f.endsWith('.ckpt') || f.endsWith('.pt'));
        }

        res.json({
            text: ollamaModels.data.models.map(m => m.name),
            image: imageModels,
            clip: clips,
            vae: vaes
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/models/download', async (req, res) => {
    const { type, name, url } = req.body;
    try {
        if (type === 'text') {
            // Ollama pull
            const response = await axios.post(`${OLLAMA_URL}/api/pull`, { name, stream: false });
            return res.json({ message: `Started pulling text model ${name}`, detail: response.data });
        } else if (['image', 'clip', 'vae'].includes(type)) {
            if (!url) return res.status(400).json({ error: 'URL is required for model download' });

            const fileName = name || url.split('/').pop();
            let subfolder = 'checkpoints';
            if (type === 'clip') subfolder = 'clip';
            else if (type === 'vae') subfolder = 'vae';
            else if (fileName.endsWith('.gguf')) subfolder = 'unet';

            const targetDir = path.join(process.env.IMAGEGEN_MODELS_PATH || '/app/models_imagegen', subfolder);

            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            const targetPath = path.join(targetDir, fileName);

            console.log(`Downloading ${type} model from ${url} to ${targetPath}`);
            const response = await axios({ method: 'get', url, responseType: 'stream' });
            const writer = fs.createWriteStream(targetPath);
            response.data.pipe(writer);

            writer.on('finish', () => res.json({ message: `Downloaded ${type} model ${fileName} to ${subfolder}` }));
            writer.on('error', (err) => res.status(500).json({ error: err.message }));
        } else {
            res.status(400).json({ error: 'Invalid model type' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- UTILS ---

const getOutputPath = () => {
    const now = new Date();
    const folderName = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const dir = path.join(__dirname, 'storage', 'gateway', 'output', folderName);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
        // Ensure the leaf directory has the correct mode regardless of umask
        fs.chmodSync(dir, 0o777);
    }
    return dir;
};

const saveJson = (data, type, dir) => {
    const filename = `${type}_${Date.now()}.json`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o666 });
    // Explicitly chmod to ensure umask doesn't interfere
    fs.chmodSync(filePath, 0o666);
    return filename;
};

const downloadFile = async (filename, subfolder, type, targetDir) => {
    try {
        console.log(`Downloading ${filename} to ${targetDir}...`);
        const response = await axios({
            method: 'get',
            url: `${COMFYUI_URL}/view`,
            params: { filename, subfolder, type },
            responseType: 'stream'
        });
        const filePath = path.join(targetDir, filename);
        const writer = fs.createWriteStream(filePath, { mode: 0o666 });
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                try {
                    fs.chmodSync(filePath, 0o666);
                    console.log(`Successfully downloaded and set permissions for ${filename}`);
                } catch (e) {
                    console.warn(`Could not set permissions for ${filename}: ${e.message}`);
                }
                resolve(filePath);
            });
            writer.on('error', (err) => {
                console.error(`Error writing ${filename}:`, err.message);
                reject(err);
            });
        });
    } catch (error) {
        console.error(`Failed to download ${filename}:`, error.message);
        return null;
    }
};

const pollAndDownload = async (prompt_id, targetDir) => {
    console.log(`Starting poll for prompt_id: ${prompt_id}`);
    let completed = false;
    let attempts = 0;
    const maxAttempts = 100;
    const downloadedFiles = [];

    while (!completed && attempts < maxAttempts) {
        try {
            const response = await axios.get(`${COMFYUI_URL}/history/${prompt_id}`);
            const history = response.data[prompt_id];
            if (history && history.outputs) {
                console.log(`Prompt ${prompt_id} completed. Downloading outputs...`);
                for (const nodeId in history.outputs) {
                    const output = history.outputs[nodeId];
                    if (output.images) {
                        for (const img of output.images) {
                            const filePath = await downloadFile(img.filename, img.subfolder, img.type, targetDir);
                            if (filePath) downloadedFiles.push(filePath);
                        }
                    }
                    if (output.gifs) {
                        for (const vid of output.gifs) {
                            const filePath = await downloadFile(vid.filename, vid.subfolder, vid.type, targetDir);
                            if (filePath) downloadedFiles.push(filePath);
                        }
                    }
                }
                completed = true;
            }
        } catch (error) {
            console.error(`Polling error for ${prompt_id}:`, error.message);
        }
        if (!completed) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;
        }
    }
    if (!completed) console.warn(`Polling timed out for ${prompt_id}`);
    return downloadedFiles;
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
            if (req.path === '/api/generate' || req.path === '/api/chat') {
                saveJson({ request: req.body, response: response.data }, 'proxy_ollama', getOutputPath());
            }
            res.status(response.status).json(response.data);
        }
    } catch (error) {
        console.error('Ollama Proxy Error:', error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Ollama service error' });
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
        if (req.path === '/prompt') {
            const dir = getOutputPath();
            saveJson({ request: req.body, response: response.data }, 'proxy_comfy', dir);
            pollAndDownload(response.data.prompt_id, dir); // Background task
        }
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('ComfyUI Proxy Error:', error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'ComfyUI service error' });
    }
});

// --- INDIVIDUAL ENDPOINTS ---

app.post('/text/gen', authenticate, async (req, res) => {
    try {
        const { prompt, model = 'llama3.2', seed = Math.floor(Math.random() * 1000000) } = req.body;
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, { model, prompt, stream: false, options: { seed } });
        saveJson({ request: req.body, response: response.data }, 'text_gen', getOutputPath());
        res.json({ response: response.data.response, seed });
    } catch (error) {
        const status = error.response?.status || 500;
        const data = error.response?.data || { error: error.message };
        res.status(status).json(data);
    }
});

app.post('/text/embeddings', authenticate, async (req, res) => {
    try {
        const { prompt, model = 'qwen3-embedding:4b' } = req.body;
        const response = await axios.post(`${OLLAMA_URL}/api/embeddings`, { model, prompt });
        saveJson({ request: req.body, response: response.data }, 'text_embeddings', getOutputPath());
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/text/expand', authenticate, async (req, res) => {
    try {
        const { text, context = 'General', seed = Math.floor(Math.random() * 1000000) } = req.body;
        const prompt = `Expand the following text within a ${context} context: "${text}"`;
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, { model: 'llama3.2', prompt, stream: false, options: { seed } });
        saveJson({ request: req.body, response: response.data }, 'text_expand', getOutputPath());
        res.json({ expanded: response.data.response, seed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/text/continue', authenticate, async (req, res) => {
    try {
        const { text, seed = Math.floor(Math.random() * 1000000) } = req.body;
        const prompt = `Continue the following story or text naturally: "${text}"`;
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, { model: 'llama3.2', prompt, stream: false, options: { seed } });
        saveJson({ request: req.body, response: response.data }, 'text_continue', getOutputPath());
        res.json({ continuation: response.data.response, seed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/visual/optimize-prompt', authenticate, async (req, res) => {
    try {
        const { idea, target = 'image', seed = Math.floor(Math.random() * 1000000) } = req.body;
        const prompt = `High-quality Stable Diffusion prompt for ${target}: "${idea}"`;
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, { model: 'llama3.2', prompt, stream: false, options: { seed } });
        saveJson({ request: req.body, response: response.data }, 'visual_optimize', getOutputPath());
        res.json({ optimized_prompt: response.data.response, seed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/image/gen', authenticate, async (req, res) => {
    try {
        const { prompt, model = 'v1-5-pruned-emaonly.safetensors', base_model = 'v1-5-pruned-emaonly.safetensors', clip_model, vae_model, negative_prompt = "blurry, low quality", seed = Math.floor(Math.random() * 1000000), steps = 20 } = req.body;

        const isGGUF = model.endsWith('.gguf');

        const workflow = {
            "3": { "class_type": "KSampler", "inputs": { "cfg": 8, "denoise": 1, "model": [isGGUF ? "10" : "4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "euler", "scheduler": "normal", "seed": seed, "steps": steps, "latent_image": ["5", 0] } },
            "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": isGGUF ? base_model : model } },
            "5": { "class_type": "EmptyLatentImage", "inputs": { "batch_size": 1, "height": 512, "width": 512 } },
            "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": [clip_model ? "11" : "4", clip_model ? 0 : 1], "text": prompt } },
            "7": { "class_type": "CLIPTextEncode", "inputs": { "clip": [clip_model ? "11" : "4", clip_model ? 0 : 1], "text": negative_prompt } },
            "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": [vae_model ? "12" : "4", vae_model ? 0 : 2] } },
            "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "gen", "images": ["8", 0] } }
        };

        if (isGGUF) {
            workflow["10"] = { "class_type": "UnetLoaderGGUF", "inputs": { "unet_name": model } };
        }

        if (clip_model) {
            const isClipGGUF = clip_model.endsWith('.gguf');
            let clipType = 'stable_diffusion';
            const unifiedModelName = (model + base_model).toLowerCase();

            if (unifiedModelName.includes('lumina') || unifiedModelName.includes('z-image')) {
                clipType = 'lumina2';
            } else if (unifiedModelName.includes('xl')) {
                clipType = 'stable_xl';
            }

            workflow["11"] = {
                "class_type": isClipGGUF ? "CLIPLoaderGGUF" : "CLIPLoader",
                "inputs": { "clip_name": clip_model, "type": clipType }
            };
            workflow["6"].inputs.clip = ["11", 0];
            workflow["7"].inputs.clip = ["11", 0];
        }

        if (vae_model) {
            workflow["12"] = { "class_type": "VAELoader", "inputs": { "vae_name": vae_model } };
            workflow["8"].inputs.vae = ["12", 0];
        } else {
            const unifiedModelName = (model + base_model).toLowerCase();
            if (unifiedModelName.includes('lumina') || unifiedModelName.includes('z-image')) {
                // Attempt to auto-find a Lumina VAE if none provided
                const vaeDir = path.join(process.env.IMAGEGEN_MODELS_PATH || '/app/models_imagegen', 'vae');
                if (fs.existsSync(vaeDir)) {
                    const luminaVAEs = fs.readdirSync(vaeDir).filter(f => f.toLowerCase().includes('lumina') && (f.endsWith('.safetensors') || f.endsWith('.ckpt') || f.endsWith('.pt')));
                    if (luminaVAEs.length > 0) {
                        console.log(`Auto-selecting Lumina VAE: ${luminaVAEs[0]}`);
                        workflow["12"] = { "class_type": "VAELoader", "inputs": { "vae_name": luminaVAEs[0] } };
                        workflow["8"].inputs.vae = ["12", 0];
                    }
                }
            }
        }

        const response = await axios.post(`${COMFYUI_URL}/prompt`, { prompt: workflow });
        const dir = getOutputPath();
        saveJson({ request: req.body, workflow, response: response.data }, 'image_gen', dir);

        const downloadedFiles = await pollAndDownload(response.data.prompt_id, dir);

        let base64Image = "";
        if (downloadedFiles && downloadedFiles.length > 0) {
            const firstImagePath = downloadedFiles[0];
            const imageBuffer = fs.readFileSync(firstImagePath);
            base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        }

        res.json({
            ...response.data,
            seed,
            steps,
            image: base64Image
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/image/edit', authenticate, async (req, res) => {
    try {
        const { image_name, prompt, denoise = 0.6, seed = Math.floor(Math.random() * 1000000), steps = 20 } = req.body;
        const workflow = {
            "10": { "class_type": "LoadImage", "inputs": { "image": image_name } },
            "11": { "class_type": "VAEEncode", "inputs": { "pixels": ["10", 0], "vae": ["4", 2] } },
            "3": { "class_type": "KSampler", "inputs": { "cfg": 8, "denoise": denoise, "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "euler", "scheduler": "normal", "seed": seed, "steps": steps, "latent_image": ["11", 0] } },
            "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" } },
            "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": prompt } },
            "7": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": "low quality" } },
            "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
            "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "edit", "images": ["8", 0] } }
        };
        const response = await axios.post(`${COMFYUI_URL}/prompt`, { prompt: workflow });
        const dir = getOutputPath();
        saveJson({ request: req.body, workflow, response: response.data }, 'image_edit', dir);

        const downloadedFiles = await pollAndDownload(response.data.prompt_id, dir);

        let base64Image = "";
        if (downloadedFiles && downloadedFiles.length > 0) {
            const firstImagePath = downloadedFiles[0];
            const imageBuffer = fs.readFileSync(firstImagePath);
            base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        }

        res.json({
            ...response.data,
            seed,
            steps,
            image: base64Image
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/video/gen', authenticate, async (req, res) => {
    try {
        const { prompt, frames = 16, seed = Math.floor(Math.random() * 1000000), steps = 15 } = req.body;
        const workflow = {
            "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" } },
            "2": { "class_type": "EmptyLatentImage", "inputs": { "batch_size": frames, "height": 512, "width": 512 } },
            "3": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["1", 1], "text": prompt } },
            "4": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["1", 1], "text": "low quality, static" } },
            "5": { "class_type": "ADE_AnimateDiffLoaderWithContext", "inputs": { "model_name": "mm_sd_v15_v2.ckpt", "beta_schedule": "sqrt_linear (AnimateDiff)", "model": ["1", 0], "context_options": ["6", 0] } },
            "6": { "class_type": "ADE_AnimateDiffUniformContextOptions", "inputs": { "context_length": 16, "context_stride": 1, "context_overlap": 4, "closed_loop": false, "context_schedule": "uniform" } },
            "7": { "class_type": "KSampler", "inputs": { "cfg": 8, "denoise": 1, "latent_image": ["2", 0], "model": ["5", 0], "negative": ["4", 0], "positive": ["3", 0], "sampler_name": "euler", "scheduler": "normal", "seed": seed, "steps": steps } },
            "8": { "class_type": "VAEDecode", "inputs": { "samples": ["7", 0], "vae": ["1", 2] } },
            "9": { "class_type": "VHS_VideoCombine", "inputs": { "images": ["8", 0], "format": "video/h264-mp4", "filename_prefix": "video", "fps": 8, "frame_rate": 8, "loop_count": 0, "save_output": true, "pingpong": false } }
        };
        const response = await axios.post(`${COMFYUI_URL}/prompt`, { prompt: workflow });
        const dir = getOutputPath();
        saveJson({ request: req.body, workflow, response: response.data }, 'video_gen', dir);
        pollAndDownload(response.data.prompt_id, dir);
        res.json({ ...response.data, seed, steps });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/agent/character', authenticate, async (req, res) => {
    try {
        const { description, seed = Math.floor(Math.random() * 1000000), steps = 20 } = req.body;
        const dataPrompt = `Generate a character based on: "${description}". Output ONLY a JSON object with these keys: "name", "history", "appearance", "skills" (array), "visual_prompt".`;
        const dataResponse = await axios.post(`${OLLAMA_URL}/api/generate`, { model: 'llama3.2', prompt: dataPrompt, format: 'json', stream: false, options: { seed } });
        const characterData = JSON.parse(dataResponse.data.response);
        const workflow = {
            "3": { "class_type": "KSampler", "inputs": { "cfg": 8, "denoise": 1, "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "euler", "scheduler": "normal", "seed": seed, "steps": steps, "latent_image": ["5", 0] } },
            "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" } },
            "5": { "class_type": "EmptyLatentImage", "inputs": { "batch_size": 1, "height": 512, "width": 512 } },
            "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": characterData.visual_prompt || "character portrait" } },
            "7": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": "low quality, blurry" } },
            "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
            "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "char", "images": ["8", 0] } }
        };
        const imageResponse = await axios.post(`${COMFYUI_URL}/prompt`, { prompt: workflow });
        const dir = getOutputPath();

        const downloadedFiles = await pollAndDownload(imageResponse.data.prompt_id, dir);

        let base64Image = "";
        if (downloadedFiles && downloadedFiles.length > 0) {
            const firstImagePath = downloadedFiles[0];
            const imageBuffer = fs.readFileSync(firstImagePath);
            base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        }

        const result = {
            character: characterData,
            image_prompt_id: imageResponse.data.prompt_id,
            seed,
            steps,
            image: base64Image
        };
        saveJson({ request: req.body, workflow, response: result }, 'agent_character', dir);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
