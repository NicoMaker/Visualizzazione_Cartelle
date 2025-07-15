let currentPath = '';

async function fetchTree(path = '') {
  const res = await fetch(`/api/tree?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('Impossibile caricare la cartella');
  const data = await res.json();
  return data.tree;
}

function createTreeNode(node, parentPath = '') {
  if (node.type === 'folder') {
    const folderDiv = document.createElement('div');
    folderDiv.className = 'folder';
    const toggle = document.createElement('span');
    toggle.className = 'folder-toggle';
    toggle.textContent = '▶';
    folderDiv.appendChild(toggle);
    const nameSpan = document.createElement('span');
    nameSpan.textContent = node.name;
    folderDiv.appendChild(nameSpan);
    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'tree-children';
    childrenDiv.style.display = 'none';
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        childrenDiv.appendChild(createTreeNode(child, node.path));
      });
    }
    folderDiv.appendChild(childrenDiv);
    folderDiv.addEventListener('click', function(e) {
      e.stopPropagation();
      if (childrenDiv.style.display === 'none') {
        childrenDiv.style.display = 'block';
        toggle.textContent = '▼';
      } else {
        childrenDiv.style.display = 'none';
        toggle.textContent = '▶';
      }
    });
    // Navigazione nella cartella cliccando sul nome
    nameSpan.style.cursor = 'pointer';
    nameSpan.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      navigateTo(node.path);
    });
    return folderDiv;
  } else {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = node.name;
    fileDiv.appendChild(nameSpan);
    const download = document.createElement('a');
    download.className = 'download-link';
    download.href = `/api/download?path=${encodeURIComponent(node.path)}`;
    download.textContent = 'Scarica';
    download.setAttribute('download', node.name);
    fileDiv.appendChild(download);
    return fileDiv;
  }
}

function renderBreadcrumb(path) {
  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = '';
  const parts = path ? path.split(/\\|\//).filter(Boolean) : [];
  let acc = '';
  // Home
  const home = document.createElement('a');
  home.textContent = 'Home';
  home.className = 'breadcrumb-link';
  home.href = '#';
  home.addEventListener('click', e => {
    e.preventDefault();
    navigateTo('');
  });
  breadcrumb.appendChild(home);
  if (parts.length > 0) {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-sep';
    sep.textContent = '›';
    breadcrumb.appendChild(sep);
  }
  parts.forEach((part, idx) => {
    acc = parts.slice(0, idx + 1).join(path.includes('\\') ? '\\' : '/');
    const link = document.createElement('a');
    link.textContent = part;
    link.className = 'breadcrumb-link';
    link.href = '#';
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(acc);
    });
    breadcrumb.appendChild(link);
    if (idx < parts.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = '›';
      breadcrumb.appendChild(sep);
    }
  });
}

async function renderTree(path = '') {
  const treeContainer = document.getElementById('tree-container');
  const statusMessage = document.getElementById('status-message');
  treeContainer.innerHTML = '<div>Caricamento...</div>';
  statusMessage.textContent = '';
  try {
    const tree = await fetchTree(path);
    treeContainer.innerHTML = '';
    if (tree.length === 0) {
      treeContainer.innerHTML = '<div>Nessun file o cartella presente.</div>';
    } else {
      tree.forEach(node => {
        treeContainer.appendChild(createTreeNode(node, path));
      });
    }
    renderBreadcrumb(path);
    currentPath = path;
  } catch (err) {
    treeContainer.innerHTML = '';
    statusMessage.textContent = err.message;
  }
}

function navigateTo(path) {
  renderTree(path);
}

document.addEventListener('DOMContentLoaded', () => {
  renderTree();
}); 