let currentPath = '';
let navigationHistory = [];

// Utility per animazioni
function animateElement(element, animationClass, duration = 300) {
  element.classList.add(animationClass);
  setTimeout(() => {
    element.classList.remove(animationClass);
  }, duration);
}

// Fetch della struttura dell'albero
async function fetchTree(path = '') {
  try {
    const res = await fetch(`/api/tree?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Impossibile caricare la cartella');
    const data = await res.json();
    return data.tree;
  } catch (error) {
    console.error('Errore nel caricamento:', error);
    throw error;
  }
}

// Creazione di un nodo dell'albero
function createTreeNode(node, parentPath = '') {
  const nodeElement = document.createElement('div');
  nodeElement.className = node.type === 'folder' ? 'folder' : 'file';

  // Aggiungi icona
  const icon = document.createElement('span');
  icon.className = node.type === 'folder' ? 'folder-icon' : 'file-icon';
  icon.textContent = node.type === 'folder' ? '📁' : getFileIcon(node.name);
  nodeElement.appendChild(icon);

  if (node.type === 'folder') {
    // Toggle per cartelle
    const toggle = document.createElement('span');
    toggle.className = 'folder-toggle';
    toggle.textContent = '▶';
    nodeElement.appendChild(toggle);

    // Nome della cartella
    const nameSpan = document.createElement('span');
    nameSpan.textContent = node.name;
    nodeElement.appendChild(nameSpan);

    // Bottone Scarica ZIP
    const zipLink = document.createElement('a');
    zipLink.className = 'download-link';
    zipLink.href = `/api/download-folder?path=${encodeURIComponent(node.path)}`;
    zipLink.textContent = '⬇ Scarica ZIP';
    zipLink.setAttribute('download', node.name + '.zip');
    zipLink.style.marginLeft = '10px';
    zipLink.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    nodeElement.appendChild(zipLink);

    // Container per i figli
    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'tree-children';
    childrenDiv.style.display = 'none';

    // Popola i figli se esistono
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        childrenDiv.appendChild(createTreeNode(child, node.path));
      });
    }

    nodeElement.appendChild(childrenDiv);

    // Event listener per il toggle
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFolder(childrenDiv, toggle);
    });

    // Event listener per la navigazione
    nodeElement.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target !== toggle) {
        navigateTo(node.path);
      }
    });

    // Doppio click per aprire la cartella
    nameSpan.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      navigateTo(node.path);
    });

  } else {
    // Gestione file
    const nameSpan = document.createElement('span');
    nameSpan.textContent = node.name;
    nodeElement.appendChild(nameSpan);

    // Link di download
    const downloadLink = document.createElement('a');
    downloadLink.className = 'download-link';
    downloadLink.href = `/api/download?path=${encodeURIComponent(node.path)}`;
    downloadLink.textContent = '⬇ Scarica';
    downloadLink.setAttribute('download', node.name);

    // Previeni la propagazione del click
    downloadLink.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    nodeElement.appendChild(downloadLink);
  }

  return nodeElement;
}

// Funzione per ottenere l'icona del file basata sull'estensione
function getFileIcon(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  const iconMap = {
    // Documenti
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'txt': '📃',

    // Immagini
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'svg': '🖼️',

    // Video
    'mp4': '🎥',
    'avi': '🎥',
    'mov': '🎥',
    'mkv': '🎞️',

    // Audio
    'mp3': '🎵',
    'wav': '🎵',
    'ogg': '🎧',
    'flac': '🎼',

    // Archivi
    'zip': '📦',
    'rar': '📦',
    '7z': '📦',
    'tar': '📦',
    'gz': '📦',

    // Web & Script
    'js': '💻',
    'ts': '💻',
    'html': '🌐',
    'css': '🎨',
    'json': '📋',
    'xml': '📋',

    // Linguaggi di programmazione
    'py': '🐍',
    'java': '☕',
    'c': '🅲',
    'cpp': '➕➕',
    'cs': '🎯',       // C#
    'php': '🐘',
    'rb': '💎',       // Ruby
    'go': '🐹',       // Golang
    'swift': '🕊️',
    'kt': '🔷',       // Kotlin
    'rs': '🦀',       // Rust
    'r': '📊',
    'dart': '🎯',
    'scala': '⚙️',
    'lua': '🌙',
    'sh': '🖥️',       // Bash/Shell
    'bat': '🖥️',
    'pl': '🦪',       // Perl
    'hs': '🧠',       // Haskell
    'ex': '🍷',       // Elixir
    'clj': '🧬',      // Clojure
    'lisp': '🧬',
    'asm': '⚙️',
    'vba': '📊',
    'mat': '📐'       // MATLAB
  };

  return iconMap[extension] || '📄';
}

// Funzione per il toggle delle cartelle
function toggleFolder(childrenDiv, toggle) {
  const isOpen = childrenDiv.style.display !== 'none';

  if (isOpen) {
    childrenDiv.style.display = 'none';
    toggle.textContent = '▶';
  } else {
    childrenDiv.style.display = 'block';
    toggle.textContent = '▼';
    animateElement(childrenDiv, 'fadeInUp');
  }
}

// Rendering del breadcrumb
function renderBreadcrumb(path) {
  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = '';

  const parts = path ? path.split(/\\|\//).filter(Boolean) : [];
  let accumulator = '';

  // Pulsante Home
  const homeButton = document.createElement('a');
  homeButton.textContent = '🏠 Home';
  homeButton.className = 'breadcrumb-link';
  homeButton.href = '#';
  homeButton.addEventListener('click', e => {
    e.preventDefault();
    navigateTo('');
  });
  breadcrumb.appendChild(homeButton);

  // Aggiungi le parti del percorso
  parts.forEach((part, index) => {
    // Separatore
    const separator = document.createElement('span');
    separator.className = 'breadcrumb-sep';
    separator.textContent = '›';
    breadcrumb.appendChild(separator);

    // Costruisci il percorso accumulato
    accumulator = parts.slice(0, index + 1).join(path.includes('\\') ? '\\' : '/');

    // Link del breadcrumb
    const link = document.createElement('a');
    link.textContent = part;
    link.className = 'breadcrumb-link';
    link.href = '#';
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(accumulator);
    });
    breadcrumb.appendChild(link);
  });
}

// Funzione per creare il pulsante "Torna indietro"
function createBackButton() {
  if (currentPath === '') return null;

  const backButton = document.createElement('button');
  backButton.className = 'back-button';
  backButton.innerHTML = '← Torna indietro';

  backButton.addEventListener('click', () => {
    const parentPath = currentPath.split(/\\|\//).slice(0, -1).join('/');
    navigateTo(parentPath);
  });

  return backButton;
}

// Rendering dell'albero
async function renderTree(path = '') {
  const treeContainer = document.getElementById('tree-container');
  const statusMessage = document.getElementById('status-message');

  // Mostra loading
  treeContainer.innerHTML = '<div class="loading">Caricamento in corso...</div>';
  statusMessage.textContent = '';

  try {
    const tree = await fetchTree(path);
    treeContainer.innerHTML = '';

    // Aggiungi pulsante back se non siamo nella root
    const backButton = createBackButton();
    if (backButton) {
      treeContainer.appendChild(backButton);
    }

    // Aggiungi pulsante Scarica tutto in ZIP se non siamo nella root
    const rootZipBtn = document.getElementById('download-root-zip');
    if (rootZipBtn) {
      const zipLink = document.createElement('a');
      zipLink.className = 'download-link';
      zipLink.href = `/api/download-folder?path=${encodeURIComponent(path)}`;
      zipLink.textContent = '⬇ Scarica tutto in ZIP';
      zipLink.setAttribute('download', 'tutto.zip');
      zipLink.style.marginLeft = '10px';
      zipLink.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      treeContainer.appendChild(zipLink);
    }

    // Verifica se la cartella è vuota
    if (tree.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'Nessun file o cartella presente in questa directory.';
      treeContainer.appendChild(emptyState);
    } else {
      // Aggiungi i nodi dell'albero
      tree.forEach((node, index) => {
        const nodeElement = createTreeNode(node, path);
        nodeElement.style.animationDelay = `${index * 0.1}s`;
        treeContainer.appendChild(nodeElement);
      });
    }

    // Aggiorna breadcrumb e percorso corrente
    renderBreadcrumb(path);
    currentPath = path;

    // Aggiungi alla cronologia se non è già presente
    if (navigationHistory[navigationHistory.length - 1] !== path) {
      navigationHistory.push(path);
    }

  } catch (error) {
    treeContainer.innerHTML = '';
    statusMessage.textContent = `Errore: ${error.message}`;
    console.error('Errore nel rendering dell\'albero:', error);
  }
}

// Funzione di navigazione
function navigateTo(path) {
  if (path === currentPath) return;

  // Animazione di transizione
  const container = document.getElementById('tree-container');
  container.style.opacity = '0.5';
  container.style.transform = 'translateY(10px)';

  setTimeout(() => {
    renderTree(path).then(() => {
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
      container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    });
  }, 150);
}

// Gestione della navigazione con tasti
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentPath !== '') {
    const parentPath = currentPath.split(/\\|\//).slice(0, -1).join('/');
    navigateTo(parentPath);
  }

  if (e.key === 'Backspace' && currentPath !== '' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    const parentPath = currentPath.split(/\\|\//).slice(0, -1).join('/');
    navigateTo(parentPath);
  }
});

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
  // Aggiungi stili CSS per le transizioni
  const style = document.createElement('style');
  style.textContent = `
    #tree-container {
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
  `;
  document.head.appendChild(style);

  // Carica l'albero iniziale
  renderTree();

  // Aggiungi tooltip per i controlli
  document.addEventListener('mouseover', (e) => {
    if (e.target.classList.contains('folder-toggle')) {
      e.target.title = 'Espandi/Comprimi cartella';
    }
    if (e.target.classList.contains('download-link')) {
      e.target.title = 'Scarica file';
    }
    if (e.target.classList.contains('back-button')) {
      e.target.title = 'Torna alla cartella precedente (Esc)';
    }
  });

  // Gestione bottone Scarica tutto in ZIP
  const rootZipBtn = document.getElementById('download-root-zip');
  if (rootZipBtn) {
    rootZipBtn.addEventListener('click', function () {
      // Scarica la cartella corrente (root o sottocartella)
      const zipUrl = `/api/download-folder?path=${encodeURIComponent(currentPath)}`;
      window.location.href = zipUrl;
    });
  }
});

// Gestione errori globali
window.addEventListener('error', (e) => {
  console.error('Errore globale:', e.error);
  const statusMessage = document.getElementById('status-message');
  if (statusMessage) {
    statusMessage.textContent = 'Si è verificato un errore imprevisto. Ricarica la pagina.';
  }
});

// Utility per il debugging
window.debugInfo = {
  currentPath: () => currentPath,
  navigationHistory: () => navigationHistory,
  navigateTo: navigateTo
};