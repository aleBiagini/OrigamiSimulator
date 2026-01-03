/**
 * TriFoldPaper.js
 * A standalone Three.js component for letter-style tri-fold paper animation.
 * Updated: Adds inner crease shadows (ambient occlusion) at the folds.
 */

class TriFoldPaper {
    constructor(options = {}) {
        this.width = options.width || 2;
        this.height = options.height || 3;
        this.foldDuration = options.foldDuration || 1000;
        this.frontColor = options.frontColor || 0xffffff;
        this.backColor = options.backColor || 0xf5f5f0;
        this.centerRatio = options.centerRatio || 2;

        this.isFolded = false;
        this.isAnimating = false;
        this.foldProgress = 0;
        this.targetProgress = 0;
        this.animationStartTime = null;
        this.animationStartProgress = 0;
        this.foldGap = options.foldGap || 0.015;
        this.restAngle = options.restAngle || 0.0;

        this.group = new THREE.Group();
        this.sideWidth = this.width / (2 + this.centerRatio);
        this.centerWidth = this.sideWidth * this.centerRatio;

        this._createPanels();
    }

    _createPanels() {
        const sideGeometry = new THREE.PlaneGeometry(this.sideWidth, this.height);
        const centerGeometry = new THREE.PlaneGeometry(this.centerWidth, this.height);

        const frontMaterial = new THREE.MeshPhongMaterial({
            color: this.frontColor,
            side: THREE.FrontSide,
            flatShading: true
        });

        const backMaterial = new THREE.MeshPhongMaterial({
            color: this.backColor,
            side: THREE.BackSide,
            flatShading: true
        });

        // --- Left Panel Group ---
        // Pivots around right edge (x = 0 in group space)
        this.leftPanelGroup = new THREE.Group();
        this.leftPanel = new THREE.Mesh(sideGeometry, frontMaterial);
        this.leftPanelBack = new THREE.Mesh(sideGeometry, backMaterial);
        // Shift geometry so the right edge aligns with x=0
        this.leftPanel.position.x = -this.sideWidth / 2;
        this.leftPanelBack.position.x = -this.sideWidth / 2;
        this.leftPanelGroup.add(this.leftPanel);
        this.leftPanelGroup.add(this.leftPanelBack);
        // Position group at the left edge of the center panel
        this.leftPanelGroup.position.x = -this.centerWidth / 2;

        // --- Center Panel ---
        this.centerPanel = new THREE.Mesh(centerGeometry, frontMaterial.clone());
        this.centerPanelBack = new THREE.Mesh(centerGeometry, backMaterial.clone());

        // --- Right Panel Group ---
        // Pivots around left edge (x = 0 in group space)
        this.rightPanelGroup = new THREE.Group();
        this.rightPanel = new THREE.Mesh(sideGeometry, frontMaterial.clone());
        this.rightPanelBack = new THREE.Mesh(sideGeometry, backMaterial.clone());
        // Shift geometry so the left edge aligns with x=0
        this.rightPanel.position.x = this.sideWidth / 2;
        this.rightPanelBack.position.x = this.sideWidth / 2;
        this.rightPanelGroup.add(this.rightPanel);
        this.rightPanelGroup.add(this.rightPanelBack);
        // Position group at the right edge of the center panel
        this.rightPanelGroup.position.x = this.centerWidth / 2;

        this.group.add(this.leftPanelGroup);
        this.group.add(this.centerPanel);
        this.group.add(this.centerPanelBack);
        this.group.add(this.rightPanelGroup);

        this._createShadows();

        this.sealLeftHalf = null;
        this.sealRightHalf = null;
    }

    _createGradientTexture() {
        // Create a canvas to generate a soft linear gradient
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        
        // Gradient from semi-transparent black to fully transparent
        const gradient = ctx.createLinearGradient(0, 0, 128, 0);
        gradient.addColorStop(0, 'rgba(80, 50, 30, 0.0)'); // Darkest at the crease
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)'); // Fade out
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 12, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    _createShadows() {
        const shadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0,
            side: THREE.FrontSide,
            depthWrite: false
        });

        // 1. Existing Drop Shadows (Cast by panels onto center)
        const leftShadowGeometry = new THREE.PlaneGeometry(this.sideWidth, this.height);
        this.leftShadow = new THREE.Mesh(leftShadowGeometry, shadowMaterial.clone());
        this.leftShadow.position.x = -this.centerWidth / 2 + this.sideWidth / 2;
        this.leftShadow.position.z = 0.001;
        this.group.add(this.leftShadow);

        const rightShadowGeometry = new THREE.PlaneGeometry(this.sideWidth, this.height);
        this.rightShadow = new THREE.Mesh(rightShadowGeometry, shadowMaterial.clone());
        this.rightShadow.position.x = this.centerWidth / 2 - this.sideWidth / 2;
        this.rightShadow.position.z = 0.001;
        this.group.add(this.rightShadow);

        // 2. New Crease Shadows (Ambient Occlusion at the folds)
        // These are narrow gradient strips placed at the hinge points
        const creaseWidth = this.sideWidth * 0.001; // How far the shadow spreads
        const creaseGeo = new THREE.PlaneGeometry(creaseWidth, this.height);
        const creaseTexture = this._createGradientTexture();
        
        const creaseMaterial = new THREE.MeshBasicMaterial({
            map: creaseTexture,
            transparent: true,
            opacity: 0, // Starts invisible, controlled by foldProgress
            side: THREE.FrontSide,
            depthWrite: false,
            blending: THREE.MultiplyBlending // Multiplies darkness for better effect
        });

        // A. Left Crease - On Center Panel (Fades Left -> Right)
        this.creaseCenterLeft = new THREE.Mesh(creaseGeo, creaseMaterial.clone());
        // Position: Left edge of center panel, shifted right by half width of shadow
        this.creaseCenterLeft.position.x = -this.centerWidth / 2 + creaseWidth / 2;
        this.creaseCenterLeft.position.z = 0.002; // Slightly above paper
        this.creaseCenterLeft.rotation.z = Math.PI; // Flip gradient to fade Left(dark)->Right(light)
        this.creaseCenterLeft.scale.x = -1; // Fix texture direction
        this.group.add(this.creaseCenterLeft);

        // B. Left Crease - On Left Panel (Fades Right -> Left)
        this.creaseLeftPanel = new THREE.Mesh(creaseGeo, creaseMaterial.clone());
        // Position: At the hinge (x=0 in group space), shifted left
        this.creaseLeftPanel.position.x = -creaseWidth / 2;
        this.creaseLeftPanel.position.z = 0.002;
        this.leftPanelGroup.add(this.creaseLeftPanel);

        // C. Right Crease - On Center Panel (Fades Right -> Left)
        this.creaseCenterRight = new THREE.Mesh(creaseGeo, creaseMaterial.clone());
        // Position: Right edge of center panel, shifted left
        this.creaseCenterRight.position.x = this.centerWidth / 2 - creaseWidth / 2;
        this.creaseCenterRight.position.z = 0.002;
        this.group.add(this.creaseCenterRight);

        // D. Right Crease - On Right Panel (Fades Left -> Right)
        this.creaseRightPanel = new THREE.Mesh(creaseGeo, creaseMaterial.clone());
        // Position: At the hinge (x=0 in group space), shifted right
        this.creaseRightPanel.position.x = creaseWidth / 2;
        this.creaseRightPanel.position.z = 0.002;
        this.creaseRightPanel.rotation.z = Math.PI;
        this.creaseRightPanel.scale.x = -1;
        this.rightPanelGroup.add(this.creaseRightPanel);

        // Store references for animation
        this.creaseShadows = [
            this.creaseCenterLeft,
            this.creaseLeftPanel,
            this.creaseCenterRight,
            this.creaseRightPanel
        ];
    }

    setSeal(svgPath, size = 1) {
        this.sealSize = size;
        const halfWidth = size / 2;
        
        fetch(svgPath)
            .then(response => response.text())
            .then(svgText => {
                const blob = new Blob([svgText], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                
                const img = new Image();
                img.onload = () => {
                    const imgWidth = img.width || 512;
                    const imgHeight = img.height || 512;
                    
                    const leftCanvas = document.createElement('canvas');
                    leftCanvas.width = imgWidth / 2;
                    leftCanvas.height = imgHeight;
                    const leftCtx = leftCanvas.getContext('2d');
                    leftCtx.drawImage(img, 0, 0, imgWidth / 2, imgHeight, 0, 0, imgWidth / 2, imgHeight);
                    
                    const rightCanvas = document.createElement('canvas');
                    rightCanvas.width = imgWidth / 2;
                    rightCanvas.height = imgHeight;
                    const rightCtx = rightCanvas.getContext('2d');
                    rightCtx.drawImage(img, imgWidth / 2, 0, imgWidth / 2, imgHeight, 0, 0, imgWidth / 2, imgHeight);
                    
                    const leftTexture = new THREE.CanvasTexture(leftCanvas);
                    const rightTexture = new THREE.CanvasTexture(rightCanvas);
                    
                    const leftGeometry = new THREE.PlaneGeometry(halfWidth, size);
                    const rightGeometry = new THREE.PlaneGeometry(halfWidth, size);
                    
                    const leftMaterial = new THREE.MeshBasicMaterial({
                        map: leftTexture,
                        transparent: true,
                        side: THREE.DoubleSide
                    });
                    
                    const rightMaterial = new THREE.MeshBasicMaterial({
                        map: rightTexture,
                        transparent: true,
                        side: THREE.DoubleSide
                    });
                    
                    this.sealLeftHalf = new THREE.Mesh(leftGeometry, leftMaterial);
                    this.sealLeftHalf.position.x = halfWidth / 2 - this.centerWidth / 2;
                    this.sealLeftHalf.position.z = -0.01;
                    this.sealLeftHalf.rotation.y = Math.PI;
                    this.leftPanelGroup.add(this.sealLeftHalf);
                    
                    this.sealRightHalf = new THREE.Mesh(rightGeometry, rightMaterial);
                    this.sealRightHalf.position.x = this.centerWidth / 2 - halfWidth / 2;
                    this.sealRightHalf.position.z = -0.01;
                    this.sealRightHalf.rotation.y = Math.PI;
                    this.rightPanelGroup.add(this.sealRightHalf);
                    
                    URL.revokeObjectURL(url);
                };
                img.src = url;
            })
            .catch(err => console.error('Failed to load seal:', err));
    }

    _easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    toggleFold() {
        if (this.isAnimating) return;
        
        this.isFolded = !this.isFolded;
        this.targetProgress = this.isFolded ? 1 : 0;
        this.animationStartTime = performance.now();
        this.animationStartProgress = this.foldProgress;
        this.isAnimating = true;
        
        this._animate();
    }

    fold() {
        if (this.isFolded || this.isAnimating) return;
        this.toggleFold();
    }

    unfold() {
        if (!this.isFolded || this.isAnimating) return;
        this.toggleFold();
    }

    _animate() {
        if (!this.isAnimating) return;

        const now = performance.now();
        const elapsed = now - this.animationStartTime;
        const duration = this.foldDuration;

        let t = Math.min(elapsed / duration, 1);
        t = this._easeInOutCubic(t);

        this.foldProgress = this.animationStartProgress + (this.targetProgress - this.animationStartProgress) * t;

        this._applyFoldTransform();

        if (elapsed < duration) {
            requestAnimationFrame(() => this._animate());
        } else {
            this.isAnimating = false;
            this.foldProgress = this.targetProgress;
        }
    }

    onClick(callback) {
        this._clickCallback = callback;
    }

    handleClick(raycaster) {
        const intersects = raycaster.intersectObjects(this.group.children, true);
        if (intersects.length > 0) {
            if (this._clickCallback) {
                this._clickCallback();
            }
            return true;
        }
        return false;
    }

    setFoldProgress(progress) {
        this.foldProgress = Math.max(0, Math.min(1, progress));
        this._applyFoldTransform();
        this.isFolded = progress >= 1;
    }

    _applyFoldTransform() {
        const foldRange = Math.PI + this.restAngle;
        const leftRotation = -this.restAngle + this.foldProgress * foldRange;
        this.leftPanelGroup.rotation.y = leftRotation;
        this.rightPanelGroup.rotation.y = -leftRotation;
        
        const zOffset = this.foldProgress * this.foldGap;
        this.leftPanelGroup.position.z = zOffset;
        this.rightPanelGroup.position.z = zOffset + 0.002;

        // 1. Update Drop Shadows (Cast Shadows)
        const maxDropShadowOpacity = 0.15;
        const dropShadowOpacity = this.foldProgress * maxDropShadowOpacity;
        if (this.leftShadow) this.leftShadow.material.opacity = dropShadowOpacity;
        if (this.rightShadow) this.rightShadow.material.opacity = dropShadowOpacity;

        // 2. Update Crease Shadows (Inner Shadows)
        // These mimic ambient occlusion: darker when closed, lighter when open.
        const minCreaseOpacity = 0;
        const maxCreaseOpacity = 0.6;
        const currentCreaseOpacity = minCreaseOpacity + (this.foldProgress * (maxCreaseOpacity - minCreaseOpacity));

        if (this.creaseShadows) {
            this.creaseShadows.forEach(mesh => {
                if (mesh.material) mesh.material.opacity = currentCreaseOpacity;
            });
        }
    }

    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TriFoldPaper };
}   