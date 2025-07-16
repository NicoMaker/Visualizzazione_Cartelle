const express = require('express');
const path = require('path');
const fs = require('fs');
const packageJson = require('./package.json');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(packageJson.rootDir || __dirname);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Enhanced folder tree function with file stats
function getFolderTree(dirPath, basePath = ROOT_DIR) {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    return items.map(item => {
      const fullPath = path.join(dirPath, item.name);
      const relPath = path.relative(basePath, fullPath);
      const stats = fs.statSync(fullPath);

      if (item.isDirectory()) {
        try {
          const children = getFolderTree(fullPath, basePath);
          return {
            name: item.name,
            type: 'folder',
            path: relPath,
            size: children.length,
            modified: stats.mtime,
            children: children
          };
        } catch (err) {
          return {
            name: item.name,
            type: 'folder',
            path: relPath,
            size: 0,
            modified: stats.mtime,
            children: [],
            error: 'Access denied'
          };
        }
      } else {
        return {
          name: item.name,
          type: 'file',
          path: relPath,
          size: stats.size,
          modified: stats.mtime,
          extension: path.extname(item.name).toLowerCase()
        };
      }
    }).sort((a, b) => {
      // Folders first, then files, both alphabetically
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    return [];
  }
}

// API to get folder structure
app.get('/api/tree', (req, res) => {
  const rel = req.query.path || '';
  const absPath = path.join(ROOT_DIR, rel);

  if (!absPath.startsWith(ROOT_DIR)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    const tree = getFolderTree(absPath, ROOT_DIR);
    const stats = fs.statSync(absPath);

    res.json({
      tree,
      rel,
      currentFolder: {
        name: path.basename(absPath) || 'Root',
        path: rel,
        modified: stats.mtime,
        itemCount: tree.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to read directory' });
  }
});

// API to download file
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

// API to download folder as ZIP
app.get('/api/download-folder', (req, res) => {
  let rel = req.query.path || '';
  const absPath = path.join(ROOT_DIR, rel);

  if (!absPath.startsWith(ROOT_DIR)) {
    return res.status(400).send('Invalid path');
  }

  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    return res.status(404).send('Folder not found');
  }

  const zipName = rel === '' ? 'Archive.zip' : `${path.basename(absPath)}.zip`;
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  res.setHeader('Content-Type', 'application/zip');

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    res.status(500).send('Archive creation failed');
  });

  archive.pipe(res);
  archive.directory(absPath, false);
  archive.finalize();
});

// Enhanced search API
app.get('/api/search', (req, res) => {
  const query = req.query.q || '';
  const searchPath = req.query.path || '';

  if (!query.trim()) return res.json({ results: [] });

  try {
    const results = searchInTree(path.join(ROOT_DIR, searchPath), query.trim());
    res.json({ results, query, searchPath });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

function searchInTree(dirPath, query, basePath = ROOT_DIR, maxResults = 100) {
  const results = [];
  const lowerQuery = query.toLowerCase();

  function searchRecursive(currentPath, depth = 0) {
    if (results.length >= maxResults || depth > 10) return;

    try {
      const items = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const item of items) {
        if (results.length >= maxResults) break;

        const fullPath = path.join(currentPath, item.name);
        const relPath = path.relative(basePath, fullPath);
        const stats = fs.statSync(fullPath);

        if (item.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            name: item.name,
            type: item.isDirectory() ? 'folder' : 'file',
            path: relPath,
            size: item.isDirectory() ? 0 : stats.size,
            modified: stats.mtime,
            extension: item.isDirectory() ? null : path.extname(item.name).toLowerCase()
          });
        }

        if (item.isDirectory() && depth < 10) {
          searchRecursive(fullPath, depth + 1);
        }
      }
    } catch (err) {
      // Skip inaccessible directories
    }
  }

  searchRecursive(dirPath);
  return results;
}

// API for system info
app.get('/api/info', (req, res) => {
  try {
    const stats = fs.statSync(ROOT_DIR);
    res.json({
      rootPath: ROOT_DIR,
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to get system info' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Modern File Explorer running on http://localhost:${PORT}`);
  console.log(`📁 Root directory: ${ROOT_DIR}`);
});
