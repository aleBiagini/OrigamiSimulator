/**
 * Build script for obfuscating frontend JavaScript code
 * Run with: npm run build
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

// Obfuscation settings
const obfuscatorOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.7,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false
};

// Paths
const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');
const distJsDir = path.join(distDir, 'js');

// Create dist directories
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Copy directory recursively
function copyDir(src, dest) {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Extract inline script from HTML and replace with obfuscated references
function extractInlineScript(html) {
    // Find the last <script> tag that contains inline code (not src attribute)
    const scriptRegex = /<script>[\s\S]*?<\/script>/g;
    const matches = html.match(scriptRegex);
    
    if (!matches || matches.length === 0) {
        return { html, script: null };
    }
    
    // Get the last inline script (the main app code)
    const lastScript = matches[matches.length - 1];
    const scriptContent = lastScript.replace(/<script>/, '').replace(/<\/script>/, '');
    
    // Replace the original TriFoldPaper.js reference with obfuscated version
    let modifiedHtml = html.replace(
        '<script src="exports/TriFoldPaper.js"></script>',
        '<script src="js/TriFoldPaper.min.js"></script>'
    );
    
    // Replace the inline script with external obfuscated reference
    modifiedHtml = modifiedHtml.replace(
        lastScript,
        '<script src="js/main.min.js"></script>'
    );
    
    return { html: modifiedHtml, script: scriptContent };
}

// Main build function
async function build() {
    console.log('Starting build process...\n');
    
    // Clean and create dist directory
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
    }
    ensureDir(distDir);
    ensureDir(distJsDir);
    
    // 1. Obfuscate TriFoldPaper.js
    console.log('Obfuscating TriFoldPaper.js...');
    const triFoldCode = fs.readFileSync(path.join(srcDir, 'exports', 'TriFoldPaper.js'), 'utf8');
    const obfuscatedTriFold = JavaScriptObfuscator.obfuscate(triFoldCode, obfuscatorOptions);
    fs.writeFileSync(path.join(distJsDir, 'TriFoldPaper.min.js'), obfuscatedTriFold.getObfuscatedCode());
    console.log('  -> dist/js/TriFoldPaper.min.js');
    
    // 2. Process index.html
    console.log('Processing index.html...');
    const indexHtml = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
    const { html: modifiedHtml, script: inlineScript } = extractInlineScript(indexHtml);
    
    // 3. Obfuscate the inline script
    if (inlineScript) {
        console.log('Obfuscating inline script...');
        const obfuscatedMain = JavaScriptObfuscator.obfuscate(inlineScript, obfuscatorOptions);
        fs.writeFileSync(path.join(distJsDir, 'main.min.js'), obfuscatedMain.getObfuscatedCode());
        console.log('  -> dist/js/main.min.js');
    }
    
    // 4. Write modified HTML
    fs.writeFileSync(path.join(distDir, 'index.html'), modifiedHtml);
    console.log('  -> dist/index.html');
    
    // 5. Copy assets folder
    const assetsDir = path.join(srcDir, 'assets');
    if (fs.existsSync(assetsDir)) {
        console.log('Copying assets...');
        copyDir(assetsDir, path.join(distDir, 'assets'));
        console.log('  -> dist/assets/');
    }
    
    // 6. Copy lista-invitati.html
    const listaInvitatiPath = path.join(srcDir, 'lista-invitati.html');
    if (fs.existsSync(listaInvitatiPath)) {
        fs.copyFileSync(listaInvitatiPath, path.join(distDir, 'lista-invitati.html'));
        console.log('  -> dist/lista-invitati.html');
    }
    
    // Note: API folder stays at root (Vercel serverless functions)
    // Note: vercel.json stays at root (Vercel config)
    
    console.log('\nBuild complete! Output in dist/ folder.');
}

build().catch(console.error);
