/**
 * TriFoldPaper.js
 * A standalone Three.js component for letter-style tri-fold paper animation.
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

        // Left panel group - pivots around right edge (x = 0 in group space)
        this.leftPanelGroup = new THREE.Group();
        this.leftPanel = new THREE.Mesh(sideGeometry, frontMaterial);
        this.leftPanelBack = new THREE.Mesh(sideGeometry, backMaterial);
        this.leftPanel.position.x = -this.sideWidth / 2;
        this.leftPanelBack.position.x = -this.sideWidth / 2;
        this.leftPanelGroup.add(this.leftPanel);
        this.leftPanelGroup.add(this.leftPanelBack);
        this.leftPanelGroup.position.x = -this.centerWidth / 2;

        // Center panel (stationary)
        this.centerPanel = new THREE.Mesh(centerGeometry, frontMaterial.clone());
        this.centerPanelBack = new THREE.Mesh(centerGeometry, backMaterial.clone());

        // Right panel group - pivots around left edge (x = 0 in group space)
        this.rightPanelGroup = new THREE.Group();
        this.rightPanel = new THREE.Mesh(sideGeometry, frontMaterial.clone());
        this.rightPanelBack = new THREE.Mesh(sideGeometry, backMaterial.clone());
        this.rightPanel.position.x = this.sideWidth / 2;
        this.rightPanelBack.position.x = this.sideWidth / 2;
        this.rightPanelGroup.add(this.rightPanel);
        this.rightPanelGroup.add(this.rightPanelBack);
        this.rightPanelGroup.position.x = this.centerWidth / 2;

        this.group.add(this.leftPanelGroup);
        this.group.add(this.centerPanel);
        this.group.add(this.centerPanelBack);
        this.group.add(this.rightPanelGroup);

        this.sealLeftHalf = null;
        this.sealRightHalf = null;
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
                    
                    // Left half of seal
                    const leftCanvas = document.createElement('canvas');
                    leftCanvas.width = imgWidth / 2;
                    leftCanvas.height = imgHeight;
                    const leftCtx = leftCanvas.getContext('2d');
                    leftCtx.drawImage(img, 0, 0, imgWidth / 2, imgHeight, 0, 0, imgWidth / 2, imgHeight);
                    
                    // Right half of seal
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
                    
                    // Left half on BACK of left panel
                    // When closed (rotated 180deg), should appear at x = -halfWidth/2
                    // Pivot is at world x = -centerWidth/2, after rotation local x flips
                    // Need: -centerWidth/2 - local_x = -halfWidth/2
                    // So: local_x = halfWidth/2 - centerWidth/2
                    this.sealLeftHalf = new THREE.Mesh(leftGeometry, leftMaterial);
                    this.sealLeftHalf.position.x = halfWidth / 2 - this.centerWidth / 2;
                    this.sealLeftHalf.position.z = -0.01;
                    this.sealLeftHalf.rotation.y = Math.PI;
                    this.leftPanelGroup.add(this.sealLeftHalf);
                    
                    // Right half on BACK of right panel
                    // When closed (rotated -180deg), should appear at x = halfWidth/2
                    // Pivot is at world x = centerWidth/2, after rotation local x flips
                    // Need: centerWidth/2 - local_x = halfWidth/2
                    // So: local_x = centerWidth/2 - halfWidth/2
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

        const foldAngle = this.foldProgress * Math.PI;
        this.leftPanelGroup.rotation.y = foldAngle;
        this.rightPanelGroup.rotation.y = -foldAngle;

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
        const foldAngle = this.foldProgress * Math.PI;
        this.leftPanelGroup.rotation.y = foldAngle;
        this.rightPanelGroup.rotation.y = -foldAngle;
        this.isFolded = progress >= 1;
    }

    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TriFoldPaper };
}
