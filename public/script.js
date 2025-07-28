class ModernFileExplorer {
  constructor() {
    this.currentPath = "";
    this.currentView = "list"; // 'list' or 'grid'
    this.sortBy = "name";
    this.sortOrder = "asc";
    this.searchTimeout = null;
    this.currentData = [];
    this.theme = localStorage.getItem("theme") || "light";

    this.init();
  }

  init() {
    this.setupTheme();
    this.setupEventListeners();
    this.loadDirectory();
  }

  setupTheme() {
    document.documentElement.setAttribute("data-theme", this.theme);
    const themeToggle = document.getElementById("theme-toggle");
    const themeIcon = themeToggle.querySelector(".theme-icon");
    themeIcon.textContent = this.theme === "dark" ? "☀️" : "🌙";
  }

  setupEventListeners() {
    // Theme toggle
    document.getElementById("theme-toggle").addEventListener("click", () => {
      this.toggleTheme();
    });

    // Search
    const searchInput = document.getElementById("search-input");
    searchInput.addEventListener("input", (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.handleSearch(e.target.value);
      }, 300);
    });

    // Navigation
    document.getElementById("back-btn").addEventListener("click", () => {
      this.navigateBack();
    });

    document.getElementById("refresh-btn").addEventListener("click", () => {
      this.loadDirectory(this.currentPath);
    });

    // View toggle
    document.getElementById("view-toggle").addEventListener("click", () => {
      this.toggleView();
    });

    // Sort controls
    document.getElementById("sort-select").addEventListener("change", (e) => {
      this.sortBy = e.target.value;
      this.renderItems(this.currentData);
    });

    document.getElementById("sort-order").addEventListener("click", () => {
      this.sortOrder = this.sortOrder === "asc" ? "desc" : "asc";
      this.updateSortOrderIcon();
      this.renderItems(this.currentData);
    });

    // Download all
    document.getElementById("download-all").addEventListener("click", () => {
      this.downloadAll();
    });

    // Close search
    document.getElementById("close-search").addEventListener("click", () => {
      this.closeSearch();
    });

    // Context menu
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".file-item")) {
        e.preventDefault();
        this.showContextMenu(e, e.target.closest(".file-item"));
      }
    });

    document.addEventListener("click", () => {
      this.hideContextMenu();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      this.handleKeyboard(e);
    });
  }

  toggleTheme() {
    this.theme = this.theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", this.theme);
    this.setupTheme();
  }

  toggleView() {
    this.currentView = this.currentView === "list" ? "grid" : "list";
    this.renderItems(this.currentData);
  }

  updateSortOrderIcon() {
    const sortOrderBtn = document.getElementById("sort-order");
    const icon = sortOrderBtn.querySelector("svg");
    if (this.sortOrder === "desc") {
      icon.innerHTML = '<path d="M3 18h18M7 12h10M11 6h2"></path>';
    } else {
      icon.innerHTML = '<path d="M3 6h18M7 12h10M11 18h2"></path>';
    }
  }

  async loadDirectory(path = "") {
    try {
      this.showLoading();
      const response = await fetch(
        `/api/tree?path=${encodeURIComponent(path)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load directory");
      }

      const data = await response.json();
      this.currentPath = path;
      this.currentData = data.tree;

      this.updateBreadcrumb(path);
      this.updateFolderInfo(data.currentFolder);
      this.renderItems(data.tree);
      this.updateBackButton();
    } catch (error) {
      this.showError("Failed to load directory");
      console.error("Error loading directory:", error);
    }
  }

  showLoading() {
    const content = document.getElementById("explorer-content");
    content.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading files...</p>
      </div>
    `;
  }

  updateBreadcrumb(path) {
    const breadcrumbPath = document.getElementById("breadcrumb-path");
    breadcrumbPath.innerHTML = "";

    const parts = path ? path.split(/[/\\]/).filter(Boolean) : [];
    let currentPath = "";

    // Home link
    const homeLink = document.createElement("a");
    homeLink.href = "#";
    homeLink.className = "breadcrumb-item";
    homeLink.innerHTML = "🏠 Home";
    homeLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.loadDirectory("");
    });
    breadcrumbPath.appendChild(homeLink);

    // Path parts
    parts.forEach((part, index) => {
      // Separator
      const separator = document.createElement("span");
      separator.className = "breadcrumb-separator";
      separator.textContent = "›";
      breadcrumbPath.appendChild(separator);

      // Path link
      currentPath = parts.slice(0, index + 1).join("/");
      const link = document.createElement("a");
      link.href = "#";
      link.className = "breadcrumb-item";
      link.textContent = part;

      if (index === parts.length - 1) {
        link.classList.add("active");
      } else {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.loadDirectory(currentPath);
        });
      }

      breadcrumbPath.appendChild(link);
    });
  }

  updateFolderInfo(folderInfo) {
    const folderName = document.querySelector(".folder-name");
    const itemCount = document.querySelector(".item-count");

    folderName.textContent = folderInfo.name;
    itemCount.textContent = `${folderInfo.itemCount} items`;
  }

  updateBackButton() {
    const backBtn = document.getElementById("back-btn");
    backBtn.disabled = this.currentPath === "";
  }

  renderItems(items) {
    const content = document.getElementById("explorer-content");

    if (!items || items.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <p>This folder is empty</p>
        </div>
      `;
      return;
    }

    const sortedItems = this.sortItems(items);
    const containerClass =
      this.currentView === "grid" ? "file-grid" : "file-list";

    content.innerHTML = `<div class="${containerClass}"></div>`;
    const container = content.querySelector(`.${containerClass}`);

    sortedItems.forEach((item) => {
      const itemElement = this.createItemElement(item);
      container.appendChild(itemElement);
    });
  }

  sortItems(items) {
    return [...items].sort((a, b) => {
      // Folders first
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      let comparison = 0;
      switch (this.sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "size":
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case "modified":
          comparison = new Date(a.modified) - new Date(b.modified);
          break;
        case "type":
          const extA = a.extension || "";
          const extB = b.extension || "";
          comparison = extA.localeCompare(extB);
          break;
      }

      return this.sortOrder === "desc" ? -comparison : comparison;
    });
  }

  createItemElement(item) {
    const element = document.createElement("div");
    element.className = "file-item";
    element.dataset.path = item.path;
    element.dataset.type = item.type;

    const icon = this.getItemIcon(item);
    const size =
      item.type === "folder"
        ? `${item.size} items`
        : this.formatFileSize(item.size);
    const date = this.formatDate(item.modified);

    element.innerHTML = `
      <div class="file-icon">${icon}</div>
      <div class="file-info">
        <div class="file-name">${this.escapeHtml(item.name)}</div>
        <div class="file-meta">
          <span class="file-size">${size}</span>
          <span class="file-date">${date}</span>
        </div>
      </div>
      <div class="file-actions">
        ${
          item.type === "folder"
            ? `<a href="/api/download-folder?path=${encodeURIComponent(item.path)}" class="download-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path>
            </svg>
            ZIP
          </a>`
            : `<a href="/api/download?path=${encodeURIComponent(item.path)}" class="download-btn" download="${item.name}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path>
            </svg>
            Download
          </a>`
        }
      </div>
    `;

    // Add click handler for navigation
    if (item.type === "folder") {
      element.addEventListener("click", (e) => {
        if (!e.target.closest(".download-btn")) {
          this.loadDirectory(item.path);
        }
      });
    }

    // Prevent download link propagation
    const downloadBtn = element.querySelector(".download-btn");
    downloadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    return element;
  }

  getItemIcon(item) {
    if (item.type === "folder") {
      return "📁";
    }

    const ext = item.extension?.toLowerCase() || "";
    const iconMap = {
      // Documents
      ".pdf": "📄",
      ".doc": "📝",
      ".docx": "📝",
      ".txt": "📃",
      ".rtf": "📝",
      ".odt": "📝",
      ".pages": "📝",

      // Images
      ".jpg": "🖼️",
      ".jpeg": "🖼️",
      ".png": "🖼️",
      ".gif": "🖼️",
      ".svg": "🖼️",
      ".bmp": "🖼️",
      ".webp": "🖼️",
      ".ico": "🖼️",

      // Video
      ".mp4": "🎥",
      ".avi": "🎥",
      ".mov": "🎥",
      ".mkv": "🎞️",
      ".wmv": "🎥",
      ".flv": "🎥",
      ".webm": "🎥",

      // Audio
      ".mp3": "🎵",
      ".wav": "🎵",
      ".ogg": "🎧",
      ".flac": "🎼",
      ".aac": "🎵",
      ".m4a": "🎵",
      ".wma": "🎵",

      // Archives
      ".zip": "📦",
      ".rar": "📦",
      ".7z": "📦",
      ".tar": "📦",
      ".gz": "📦",
      ".bz2": "📦",
      ".xz": "📦",

      // Code
      ".js": "💻",
      ".ts": "💻",
      ".html": "🌐",
      ".css": "🎨",
      ".json": "📋",
      ".xml": "📋",
      ".py": "🐍",
      ".java": "☕",
      ".c": "🅲",
      ".cpp": "➕",
      ".cs": "🎯",
      ".php": "🐘",
      ".rb": "💎",
      ".go": "🐹",
      ".swift": "🕊️",
      ".kt": "🔷",
      ".rs": "🦀",
      ".dart": "🎯",
      ".scala": "⚙️",
      ".lua": "🌙",

      // Spreadsheets
      ".xls": "📊",
      ".xlsx": "📊",
      ".csv": "📊",
      ".ods": "📊",

      // Presentations
      ".ppt": "📊",
      ".pptx": "📊",
      ".odp": "📊",
      ".key": "📊",
    };

    return iconMap[ext] || "📄";
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
    );
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;

    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  async handleSearch(query) {
    if (!query.trim()) {
      this.closeSearch();
      return;
    }

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&path=${encodeURIComponent(this.currentPath)}`,
      );
      const data = await response.json();

      this.showSearchResults(data.results, query);
    } catch (error) {
      this.showError("Search failed");
    }
  }

  showSearchResults(results, query) {
    const searchResults = document.getElementById("search-results");
    const searchContent = document.getElementById("search-content");

    searchResults.style.display = "block";

    if (results.length === 0) {
      searchContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No results found for "${query}"</p>
        </div>
      `;
      return;
    }

    const container = document.createElement("div");
    container.className = "file-list";

    results.forEach((item) => {
      const itemElement = this.createItemElement(item);
      container.appendChild(itemElement);
    });

    searchContent.innerHTML = "";
    searchContent.appendChild(container);
  }

  closeSearch() {
    document.getElementById("search-results").style.display = "none";
    document.getElementById("search-input").value = "";
  }

  navigateBack() {
    if (this.currentPath === "") return;

    const pathParts = this.currentPath.split(/[/\\]/).filter(Boolean);
    pathParts.pop();
    const parentPath = pathParts.join("/");

    this.loadDirectory(parentPath);
  }

  downloadAll() {
    const url = `/api/download-folder?path=${encodeURIComponent(this.currentPath)}`;
    window.location.href = url;
    this.showToast("Download started", "success");
  }

  showContextMenu(event, item) {
    const contextMenu = document.getElementById("context-menu");
    const itemPath = item.dataset.path;
    const itemType = item.dataset.type;

    contextMenu.style.display = "block";
    contextMenu.style.left = event.pageX + "px";
    contextMenu.style.top = event.pageY + "px";

    // Update context menu items
    const downloadItem = contextMenu.querySelector('[data-action="download"]');
    downloadItem.onclick = () => {
      if (itemType === "folder") {
        window.location.href = `/api/download-folder?path=${encodeURIComponent(itemPath)}`;
      } else {
        window.location.href = `/api/download?path=${encodeURIComponent(itemPath)}`;
      }
      this.hideContextMenu();
    };

    const copyPathItem = contextMenu.querySelector('[data-action="copy-path"]');
    copyPathItem.onclick = () => {
      navigator.clipboard.writeText(itemPath);
      this.showToast("Path copied to clipboard", "success");
      this.hideContextMenu();
    };
  }

  hideContextMenu() {
    document.getElementById("context-menu").style.display = "none";
  }

  handleKeyboard(event) {
    switch (event.key) {
      case "Escape":
        this.closeSearch();
        this.hideContextMenu();
        break;
      case "Backspace":
        if (event.target.tagName !== "INPUT" && this.currentPath !== "") {
          event.preventDefault();
          this.navigateBack();
        }
        break;
      case "F5":
        event.preventDefault();
        this.loadDirectory(this.currentPath);
        break;
      case "/":
        if (event.target.tagName !== "INPUT") {
          event.preventDefault();
          document.getElementById("search-input").focus();
        }
        break;
    }
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
    toast.innerHTML = `
      <span>${icon}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  showError(message) {
    this.showToast(message, "error");
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  new ModernFileExplorer();
});

// Service worker registration for PWA capabilities
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered: ", registration);
      })
      .catch((registrationError) => {
        console.log("SW registration failed: ", registrationError);
      });
  });
}
