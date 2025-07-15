const express = require('express');
const path = require('path');
const fs = require('fs');
const packageJson = require('./package.json');
const archiver = require('archiver');

const app = express();
const PORT = 3000;
const ROOT_DIR = path.resolve(packageJson.rootDir || __dirname); // Percorso configurabile da package.json

app.use(express.static(path.join(__dirname, 'public')));

// Funzione ricorsiva per ottenere la struttura della cartella
function getFolderTree(dirPath, basePath = ROOT_DIR) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  return items.map(item => {
    const fullPath = path.join(dirPath, item.name);
    const relPath = path.relative(basePath, fullPath);
    if (item.isDirectory()) {
      return {
        name: item.name,
        type: 'folder',
        path: relPath,
        children: getFolderTree(fullPath, basePath)
      };
    } else {
      return {
        name: item.name,
        type: 'file',
        path: relPath
      };
    }
  });
}

// Utility per capire se rootDir è un link Google Drive
function isGoogleDriveRoot(root) {
  return typeof root === 'string' && root.startsWith('https://drive.google.com');
}

// API per ottenere la struttura della cartella
app.get('/api/tree', (req, res) => {
  const rel = req.query.path || '';
  const absPath = path.join(ROOT_DIR, rel);
  if (!absPath.startsWith(ROOT_DIR)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  try {
    const tree = getFolderTree(absPath, ROOT_DIR);
    res.json({ tree, rel });
  } catch (err) {
    res.status(500).json({ error: 'Unable to read directory' });
  }
});

// API per scaricare un file
app.get('/api/download', (req, res) => {
  const rel = req.query.path;
  if (!rel) return res.status(400).send('Missing path');
  const absPath = path.join(ROOT_DIR, rel);
  if (!absPath.startsWith(ROOT_DIR)) {
    return res.status(400).send('Invalid path');
  }
  if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
    return res.status(404).send('File not found');
  }
  res.download(absPath);
});

// API per scaricare una cartella come ZIP (solo locale)
app.get('/api/download-folder', (req, res) => {
  if (isGoogleDriveRoot(packageJson.rootDir)) {
    return res.status(501).send('Download ZIP di cartelle Google Drive non ancora supportato');
  }
  let rel = req.query.path || '';
  const absPath = path.join(ROOT_DIR, rel);
  if (!absPath.startsWith(ROOT_DIR)) {
    return res.status(400).send('Invalid path');
  }
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    return res.status(404).send('Folder not found');
  }
  // Nome zip: se root, "Tutto.zip", altrimenti nome cartella
  const zipName = rel === '' ? 'Tutto.zip' : `${path.basename(absPath)}.zip`;
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.directory(absPath, false);
  archive.pipe(res);
  archive.finalize();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 