import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function PanoramaViewer() {
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.2);
  
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshRef = useRef(null);
  const isDraggingRef = useRef(false);
  const previousMouseRef = useRef({ x: 0, y: 0 });
  const lonRef = useRef(0);
  const latRef = useRef(0);

  // Initialize Three.js scene
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Create scene
  const scene = new THREE.Scene();

  // Create camera
  const camera = new THREE.PerspectiveCamera(75, 1, 1, 1100);
  camera.position.set(0, 0, 0);

  // Sphere
  const geometry = new THREE.SphereGeometry(500, 60, 40);
  geometry.scale(-1, 1, 1);

  const material = new THREE.MeshBasicMaterial({
    color: 0x333333,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  sceneRef.current = scene;
  cameraRef.current = camera;
  rendererRef.current = renderer;
  meshRef.current = mesh;

  let animationId;

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  resize();
  window.addEventListener("resize", resize);

  const animate = () => {
    animationId = requestAnimationFrame(animate);

    const phi = THREE.MathUtils.degToRad(90 - latRef.current);
    const theta = THREE.MathUtils.degToRad(lonRef.current);

    const target = new THREE.Vector3(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );

    camera.lookAt(target);
    renderer.render(scene, camera);
  };

  animate();

  return () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", resize);

    geometry.dispose();
    material.dispose();
    if (material.map) material.map.dispose();

    renderer.dispose();

    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}, []);

  // Load texture when image changes
  useEffect(() => {
    if (!meshRef.current || !images[currentIndex]) return;

    setIsLoading(true);
    console.log('Loading image:', images[currentIndex].name);

    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
      images[currentIndex].url,
      (texture) => {
        console.log('✅ Texture loaded successfully!');
        console.log('Texture size:', texture.image.width, 'x', texture.image.height);
        
        // Dispose old texture if it exists
        if (meshRef.current.material.map) {
          meshRef.current.material.map.dispose();
        }
        
        // Apply new texture
        texture.colorSpace = THREE.SRGBColorSpace;
        meshRef.current.material.map = texture;
        meshRef.current.material.color.set(0xffffff); // Reset color to white to show texture colors accurately
        meshRef.current.material.needsUpdate = true;
        
        setIsLoading(false);
      },
      (progress) => {
        if (progress.lengthComputable) {
          const percent = Math.floor((progress.loaded / progress.total) * 100);
          console.log(`Loading: ${percent}%`);
        }
      },
      (error) => {
        console.error('❌ Failed to load texture:', error);
        setIsLoading(false);
      }
    );
  }, [currentIndex, images]);

  // Mouse interaction handlers
  const onPointerDown = (event) => {
    isDraggingRef.current = true;
    previousMouseRef.current = {
      x: event.clientX || event.touches?.[0]?.clientX,
      y: event.clientY || event.touches?.[0]?.clientY
    };
  };

  const onPointerMove = (event) => {
    if (!isDraggingRef.current) return;

    const clientX = event.clientX || event.touches?.[0]?.clientX;
    const clientY = event.clientY || event.touches?.[0]?.clientY;

    const deltaX = (clientX - previousMouseRef.current.x) * sensitivity;
    const deltaY = (clientY - previousMouseRef.current.y) * sensitivity;

    lonRef.current -= deltaX;
    latRef.current = Math.max(-85, Math.min(85, latRef.current + deltaY));

    previousMouseRef.current = { x: clientX, y: clientY };
  };

  const onPointerUp = () => {
    isDraggingRef.current = false;
  };

  // Zoom with mouse wheel - ZOOM RESTORED
  const onWheel = (event) => {
    event.preventDefault();
    if (!cameraRef.current) return;
    
    const fov = cameraRef.current.fov + event.deltaY * 0.05;
    cameraRef.current.fov = Math.max(20, Math.min(100, fov));
    cameraRef.current.updateProjectionMatrix();
  };

  // File upload
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    
    const newImages = files.map(file => {
      if (!file.type.startsWith('image/')) {
        console.warn('Skipping non-image:', file.name);
        return null;
      }
      
      return {
        url: URL.createObjectURL(file),
        name: file.name
      };
    }).filter(Boolean);

    if (newImages.length > 0) {
      setImages(prev => {
        const combined = [...prev, ...newImages];
        if (prev.length === 0) setCurrentIndex(0);
        return combined;
      });
      console.log(`Added ${newImages.length} image(s)`);
    }
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(images[index].url);
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    
    if (currentIndex >= newImages.length && newImages.length > 0) {
      setCurrentIndex(newImages.length - 1);
    }
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    setCurrentIndex(0);
  };

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          width: 100%;
          height: 100%;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }

        .app {
          width: 100vw;
          height: 100vh;
          position: relative;
          overflow: hidden;
        }

        .canvas-container {
          width: 100%;
          height: 100%;
          cursor: grab;
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
        }

        .canvas-container:active {
          cursor: grabbing;
        }

        .overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 20px 30px;
          background: transparent;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
          pointer-events: none;
        }

        .overlay > * {
          pointer-events: auto;
        }

        .logo {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -1px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.8);
        }

        .logo-accent {
          color: #00d9ff;
        }

        .controls {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 10px 20px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          backdrop-filter: blur(5px);
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }

        .btn:hover {
          background: rgba(255,255,255,0.15);
          border-color: rgba(255,255,255,0.5);
          transform: translateY(-1px);
        }

        .btn-primary {
          background: #00d9ff;
          border-color: #00d9ff;
          color: #000;
          text-shadow: none;
        }

        .btn-primary:hover {
          background: #00a8cc;
          border-color: #00a8cc;
        }

        .btn-danger {
          background: rgba(255,80,80,0.2);
          border-color: rgba(255,80,80,0.4);
          color: #ff5050;
        }

        .btn-danger:hover {
          background: rgba(255,80,80,0.3);
          border-color: #ff5050;
        }

        .file-input {
          display: none;
        }

        .loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          z-index: 100;
          background: rgba(0,0,0,0.3);
          padding: 30px;
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(0,217,255,0.2);
          border-top-color: #00d9ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-text {
          color: #00d9ff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .empty {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          max-width: 90%;
          padding: 0 20px;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
          opacity: 0.5;
        }

        .empty-title {
          font-size: 28px;
          font-weight: 800;
          color: white;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }

        .empty-subtitle {
          font-size: 15px;
          color: rgba(255,255,255,0.6);
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .nav {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 16px;
          align-items: center;
          z-index: 10;
        }

        .nav-btn {
          width: 44px;
          height: 44px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s;
          backdrop-filter: blur(5px);
        }

        .nav-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.15);
          transform: scale(1.05);
        }

        .nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .nav-info {
          padding: 10px 20px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 20px;
          color: white;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          backdrop-filter: blur(5px);
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }

        .hint {
          position: absolute;
          bottom: 90px;
          left: 50%;
          transform: translateX(-50%);
          color: rgba(255,255,255,0.4);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 2px;
          animation: fade 2s ease-in-out infinite;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          white-space: nowrap;
        }

        @keyframes fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }

        .settings {
          position: absolute;
          top: 80px;
          right: 30px;
          width: 300px;
          background: rgba(0,0,0,0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 20px;
          z-index: 50;
          opacity: ${showSettings ? '1' : '0'};
          visibility: ${showSettings ? 'visible' : 'hidden'};
          transform: translateY(${showSettings ? '0' : '-10px'});
          transition: all 0.3s;
        }

        .settings-title {
          font-size: 16px;
          font-weight: 800;
          color: white;
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .setting-item {
          margin-bottom: 20px;
        }

        .setting-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          color: rgba(255,255,255,0.7);
          font-size: 13px;
        }

        .setting-value {
          color: #00d9ff;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
        }

        .slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: rgba(255,255,255,0.1);
          outline: none;
          -webkit-appearance: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #00d9ff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .slider::-webkit-slider-thumb:hover {
          background: #00f7ff;
          box-shadow: 0 0 10px rgba(0,217,255,0.5);
        }

        .slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #00d9ff;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .slider::-moz-range-thumb:hover {
          background: #00f7ff;
          box-shadow: 0 0 10px rgba(0,217,255,0.5);
        }

        .gallery {
          position: absolute;
          top: 0;
          right: 0;
          width: 300px;
          height: 100%;
          background: rgba(0,0,0,0.95);
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255,255,255,0.1);
          transform: translateX(${showGallery ? '0' : '100%'});
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 50;
          display: flex;
          flex-direction: column;
        }

        .gallery-header {
          padding: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .gallery-title {
          font-size: 16px;
          font-weight: 800;
          color: white;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .gallery-count {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin-top: 4px;
          font-family: 'JetBrains Mono', monospace;
        }

        .gallery-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .gallery-list::-webkit-scrollbar {
          width: 6px;
        }

        .gallery-list::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
        }

        .gallery-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
        }

        .gallery-item {
          position: relative;
          margin-bottom: 12px;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.2s;
        }

        .gallery-item:hover {
          border-color: rgba(255,255,255,0.3);
        }

        .gallery-item.active {
          border-color: #00d9ff;
          box-shadow: 0 0 20px rgba(0,217,255,0.3);
        }

        .gallery-thumb {
          width: 100%;
          aspect-ratio: 2/1;
          object-fit: cover;
          display: block;
        }

        .gallery-name {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 8px;
          background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
          color: white;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gallery-remove {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          background: rgba(255,0,0,0.8);
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .gallery-item:hover .gallery-remove {
          opacity: 1;
        }

        .gallery-remove:hover {
          background: #ff0000;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .gallery, .settings {
            width: 100%;
          }

          .overlay {
            padding: 16px;
          }

          .logo {
            font-size: 20px;
          }

          .controls {
            gap: 8px;
          }

          .btn {
            font-size: 11px;
            padding: 8px 14px;
          }

          .empty-title {
            font-size: 22px;
          }

          .empty-subtitle {
            font-size: 14px;
          }

          .nav {
            bottom: 20px;
          }

          .hint {
            bottom: 80px;
            font-size: 10px;
          }
        }
      `}</style>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="canvas-container"
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        onWheel={onWheel}
      />

      {/* Loading */}
      {isLoading && (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-text">Loading...</div>
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🌍</div>
          <h1 className="empty-title">360° Panorama Viewer</h1>
          <p className="empty-subtitle">
            Upload your equirectangular panorama images and explore them in immersive 3D
          </p>
          <label htmlFor="file-upload" className="btn btn-primary">
            Upload Images
          </label>
        </div>
      )}

      {/* Top bar */}
      <div className="overlay">
        <div className="logo">
          PANO<span className="logo-accent">RAMA</span>
        </div>
        <div className="controls">
          <label htmlFor="file-upload" className="btn">
            + Add
          </label>
          {images.length > 0 && (
            <>
              <button className="btn" onClick={() => setShowGallery(!showGallery)}>
                Gallery ({images.length})
              </button>
              <button className="btn btn-danger" onClick={clearAll}>
                Clear
              </button>
            </>
          )}
          <button className="btn" onClick={() => setShowSettings(!showSettings)}>
            ⚙️
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="settings">
        <div className="settings-title">⚙️ Settings</div>
        <div className="setting-item">
          <div className="setting-label">
            <span>Mouse Sensitivity</span>
            <span className="setting-value">{sensitivity.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.5"
            step="0.05"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="slider"
          />
        </div>
      </div>

      {/* File input */}
      <input
        id="file-upload"
        type="file"
        className="file-input"
        accept="image/*"
        multiple
        onChange={handleFileChange}
      />

      {/* Navigation */}
      {images.length > 1 && (
        <div className="nav">
          <button
            className="nav-btn"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            ←
          </button>
          <div className="nav-info">
            {currentIndex + 1} / {images.length}
          </div>
          <button
            className="nav-btn"
            onClick={() => setCurrentIndex(Math.min(images.length - 1, currentIndex + 1))}
            disabled={currentIndex === images.length - 1}
          >
            →
          </button>
        </div>
      )}

      {/* Hint */}
      {images.length > 0 && (
        <div className="hint">Drag to look • Scroll to zoom</div>
      )}

      {/* Gallery */}
      <div className="gallery">
        <div className="gallery-header">
          <div className="gallery-title">Gallery</div>
          <div className="gallery-count">{images.length} panoramas</div>
        </div>
        <div className="gallery-list">
          {images.map((image, index) => (
            <div
              key={index}
              className={`gallery-item ${index === currentIndex ? 'active' : ''}`}
              onClick={() => {
                setCurrentIndex(index);
                setShowGallery(false);
              }}
            >
              <img src={image.url} alt={image.name} className="gallery-thumb" />
              <div className="gallery-name">{image.name}</div>
              <button
                className="gallery-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
