FROM rocm/pytorch:latest

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git .

# Install requirements
RUN pip install --no-cache-dir -r requirements.txt websocket-client torchsde opencv-python imageio-ffmpeg pandas

# Install Custom Nodes for Video, Management and GGUF support
RUN cd custom_nodes && \
    git clone https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved.git && \
    git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git && \
    git clone https://github.com/ltdrdata/ComfyUI-Manager.git && \
    git clone https://github.com/city96/ComfyUI-GGUF.git

# Install specific requirements for custom nodes
RUN pip install --no-cache-dir -r custom_nodes/ComfyUI-VideoHelperSuite/requirements.txt && \
    pip install --no-cache-dir -r custom_nodes/ComfyUI-GGUF/requirements.txt

# Environment variables for ROCm
ENV HSA_OVERRIDE_GFX_VERSION=10.3.0
ENV HIP_VISIBLE_DEVICES=0
ENV PYTORCH_ROCM_ARCH=gfx1030

EXPOSE 8188

ENTRYPOINT ["python3", "main.py", "--listen", "0.0.0.0", "--port", "8188", "--lowvram"]
