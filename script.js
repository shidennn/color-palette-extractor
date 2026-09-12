const HISTORY_KEY = 'colorify_palette_history';
const MAX_HISTORY_ITEMS = 20;

const state = {
  image: null,
  imageUrl: null,
  colors: [],
  colorCount: 5,
  history: [],
  previewStyle: 'dashboard'
};

const elements = {
  uploadView: document.querySelector('#uploadView'),
  resultView: document.querySelector('#resultView'),
  resultContent: document.querySelector('#resultContent'),
  analysisState: document.querySelector('#analysisState'),
  dropZone: document.querySelector('#dropZone'),
  fileInput: document.querySelector('#fileInput'),
  errorMessage: document.querySelector('#errorMessage'),
  imagePreview: document.querySelector('#imagePreview'),
  imageName: document.querySelector('#imageName'),
  imageDimensions: document.querySelector('#imageDimensions'),
  paletteGrid: document.querySelector('#paletteGrid'),
  resetButton: document.querySelector('#resetButton'),
  copyCssButton: document.querySelector('#copyCssButton'),
  historyList: document.querySelector('#historyList'),
  historyEmpty: document.querySelector('#historyEmpty'),
  clearHistoryButton: document.querySelector('#clearHistoryButton'),
  historyConfirm: document.querySelector('#historyConfirm'),
  confirmClearButton: document.querySelector('#confirmClearButton'),
  cancelClearButton: document.querySelector('#cancelClearButton'),
  uiPreviewSection: document.querySelector('#uiPreviewSection'),
  previewStage: document.querySelector('#previewStage'),
  previewColorDots: document.querySelector('#previewColorDots')
};

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = false;
}

function clearError() {
  elements.errorMessage.textContent = '';
  elements.errorMessage.hidden = true;
}

function loadPaletteHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    state.history = Array.isArray(stored) ? stored.filter(isValidHistoryItem).slice(0, MAX_HISTORY_ITEMS) : [];
  } catch {
    state.history = [];
  }
  renderPaletteHistory();
}

function isValidHistoryItem(item) {
  return item && Array.isArray(item.colors) && item.colors.length > 0 && item.colors.every(isValidHex)
    && Number.isInteger(item.count) && item.count > 0 && item.count <= 12
    && typeof item.fileName === 'string' && Number.isFinite(item.createdAt);
}

function isValidHex(value) {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value);
}

function savePaletteToHistory(fileName) {
  const colors = state.colors.map(color => color.hex);
  const latest = state.history[0];
  if (latest && latest.count === state.colorCount && latest.colors.join(',') === colors.join(',')) return;

  state.history.unshift({
    colors,
    count: state.colorCount,
    fileName: fileName || 'Untitled image',
    createdAt: Date.now()
  });
  state.history = state.history.slice(0, MAX_HISTORY_ITEMS);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  } catch {
    // History is optional; extraction should still work when storage is unavailable.
  }
  renderPaletteHistory();
}

function renderPaletteHistory() {
  elements.historyList.innerHTML = state.history.map((item, index) => `
    <div class="history-item" data-history-index="${index}" role="button" tabindex="0" aria-label="Restore palette from ${escapeHtml(item.fileName)}">
      <div class="history-strip">${item.colors.map(color => `<span style="background-color: ${color}" aria-hidden="true"></span>`).join('')}</div>
      <div class="history-item-info"><strong>${escapeHtml(item.fileName)}</strong><span>${item.count} colors</span></div>
      <time datetime="${new Date(item.createdAt).toISOString()}">${formatHistoryDate(item.createdAt)}</time>
      <button class="history-delete" type="button" data-delete-history="${index}" aria-label="Remove ${escapeHtml(item.fileName)}">Remove</button>
    </div>
  `).join('');
  elements.historyEmpty.hidden = state.history.length > 0;
  elements.clearHistoryButton.hidden = state.history.length === 0;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatHistoryDate(timestamp) {
  const date = new Date(timestamp);
  const elapsed = Date.now() - timestamp;
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (elapsed < 60 * 1000) return 'Just now';
  if (elapsed < 24 * 60 * 60 * 1000) return `Today, ${time}`;
  if (elapsed < 48 * 60 * 60 * 1000) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function hexToRgb(hex) {
  const value = hex.slice(1);
  return {
    red: parseInt(value.slice(0, 2), 16),
    green: parseInt(value.slice(2, 4), 16),
    blue: parseInt(value.slice(4, 6), 16),
    hex: hex.toUpperCase(),
    weight: 0
  };
}

function restorePalette(index) {
  const item = state.history[index];
  if (!item) return;
  state.colors = item.colors.map(hexToRgb);
  state.colorCount = item.count;
  document.querySelectorAll('[data-count]').forEach(button => {
    button.classList.toggle('selected', Number(button.dataset.count) === state.colorCount);
  });
  renderPalette();
  renderPreview();
  elements.uploadView.hidden = true;
  elements.resultView.hidden = false;
  elements.analysisState.hidden = true;
  elements.resultContent.hidden = false;
}

function deleteHistoryItem(index) {
  state.history.splice(index, 1);
  persistHistory();
  renderPaletteHistory();
}

function clearPaletteHistory() {
  state.history = [];
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // History is optional; clearing the in-memory list is still useful.
  }
  elements.historyConfirm.hidden = true;
  renderPaletteHistory();
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  } catch {
    // History is optional; the current palette remains available in memory.
  }
}

function handleFile(file) {
  clearError();
  if (!file) return;
  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showError('Please choose a PNG, JPG, or WEBP image.');
    return;
  }
  loadImage(file);
}

function loadImage(file) {
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    state.image = image;
    state.imageUrl = imageUrl;
    elements.imagePreview.src = imageUrl;
    elements.imagePreview.alt = `${file.name} preview`;
    elements.imageName.textContent = file.name;
    elements.imageDimensions.textContent = `${image.naturalWidth} x ${image.naturalHeight}`;
    elements.uploadView.hidden = true;
    elements.resultView.hidden = false;
    elements.resultContent.hidden = true;
    elements.analysisState.hidden = false;
    // Let the loading state paint before doing canvas work.
    requestAnimationFrame(() => {
      state.colors = extractColors(image, state.colorCount);
      renderPalette();
      renderPreview();
      if (state.colors.length) savePaletteToHistory(file.name);
      elements.analysisState.hidden = true;
      elements.resultContent.hidden = false;
    });
  };
  image.onerror = () => {
    URL.revokeObjectURL(imageUrl);
    showError('This image could not be loaded. Try a different file.');
  };
  image.src = imageUrl;
}

function extractColors(image, requestedCount) {
  const maxDimension = 160;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const buckets = new Map();
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 12000)));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      if (pixels[index + 3] < 30) continue;
      const red = Math.min(255, Math.round(pixels[index] / 16) * 16);
      const green = Math.min(255, Math.round(pixels[index + 1] / 16) * 16);
      const blue = Math.min(255, Math.round(pixels[index + 2] / 16) * 16);
      const key = `${red},${green},${blue}`;
      const bucket = buckets.get(key) || { red, green, blue, weight: 0 };
      bucket.weight += 1;
      buckets.set(key, bucket);
    }
  }

  const candidates = [...buckets.values()].sort((a, b) => b.weight - a.weight);
  const selected = [];
  // Take frequent colors first, while enforcing visual separation.
  for (const candidate of candidates) {
    if (selected.every(color => calculateColorDistance(color, candidate) >= 34)) {
      selected.push(candidate);
      if (selected.length === requestedCount) break;
    }
  }
  // Small or very monochrome images may not have enough separated buckets.
  for (const candidate of candidates) {
    if (selected.length === requestedCount) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }
  return selected.map(color => ({ ...color, hex: rgbToHex(color.red, color.green, color.blue) }));
}

function calculateColorDistance(first, second) {
  const redMean = (first.red + second.red) / 2;
  const red = first.red - second.red;
  const green = first.green - second.green;
  const blue = first.blue - second.blue;
  return Math.sqrt(((512 + redMean) * red * red) / 256 + 4 * green * green + ((767 - redMean) * blue * blue) / 256);
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function rgbToHsl(red, green, blue) {
  red /= 255; green /= 255; blue /= 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta) {
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case red: hue = (green - blue) / delta + (green < blue ? 6 : 0); break;
      case green: hue = (blue - red) / delta + 2; break;
      default: hue = (red - green) / delta + 4;
    }
    hue /= 6;
  }
  const degrees = Math.round(hue * 360);
  const percentSaturation = Math.round(saturation * 100);
  const percentLightness = Math.round(lightness * 100);
  return {
    label: `HSL ${degrees}°, ${percentSaturation}%, ${percentLightness}%`,
    value: `hsl(${degrees}, ${percentSaturation}%, ${percentLightness}%)`
  };
}

function getRelativeLuminance(color) {
  const channels = [color.red, color.green, color.blue].map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function getColorSaturation(color) {
  const values = [color.red, color.green, color.blue].map(channel => channel / 255);
  return Math.max(...values) - Math.min(...values);
}

function getContrastRatio(first, second) {
  const firstLuminance = getRelativeLuminance(first);
  const secondLuminance = getRelativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getPreviewColors(colors) {
  if (!colors.length) return null;
  const ranked = colors.map(color => ({ ...color, luminance: getRelativeLuminance(color), saturation: getColorSaturation(color) }));
  const lightest = [...ranked].sort((first, second) => second.luminance - first.luminance)[0];
  const darkest = [...ranked].sort((first, second) => first.luminance - second.luminance)[0];
  const isDark = darkest.luminance < 0.45 && lightest.luminance - darkest.luminance > 0.2;
  const background = isDark ? darkest : lightest;
  const textCandidates = [...ranked].sort((first, second) => getContrastRatio(second, background) - getContrastRatio(first, background));
  const text = textCandidates[0];
  if (getContrastRatio(text, background) < 3) {
    const fallback = isDark ? '#F1EEE7' : '#11110F';
    text.red = hexToRgb(fallback).red;
    text.green = hexToRgb(fallback).green;
    text.blue = hexToRgb(fallback).blue;
    text.hex = fallback;
  }
  const surfaceCandidates = [...ranked].sort((first, second) => {
    const firstDistance = Math.abs(first.luminance - background.luminance);
    const secondDistance = Math.abs(second.luminance - background.luminance);
    return firstDistance - secondDistance;
  });
  const surface = surfaceCandidates.find(color => color.hex !== background.hex && getContrastRatio(color, background) > 1.15) || background;
  const accentCandidates = [...ranked].sort((first, second) => second.saturation - first.saturation);
  const accent = accentCandidates.find(color => color.hex !== background.hex && getContrastRatio(color, background) >= 2) || accentCandidates[0];
  const secondary = accentCandidates.find(color => color.hex !== accent.hex && color.hex !== background.hex) || accent;
  const mutedText = [...ranked]
    .filter(color => color.hex !== text.hex)
    .sort((first, second) => getContrastRatio(second, background) - getContrastRatio(first, background))[0] || text;
  const border = [...ranked].sort((first, second) => Math.abs(first.luminance - background.luminance) - Math.abs(second.luminance - background.luminance))[1] || accent;
  return { background, surface, text, mutedText, border, accent, secondary, colors: ranked };
}

function previewStyleProperties(roles) {
  return Object.entries({
    '--preview-bg': roles.background.hex,
    '--preview-surface': roles.surface.hex,
    '--preview-text': roles.text.hex,
    '--preview-muted': roles.mutedText.hex,
    '--preview-border': roles.border.hex,
    '--preview-accent': roles.accent.hex,
    '--preview-secondary': roles.secondary.hex
  }).map(([property, value]) => `${property}:${value}`).join(';');
}

function renderPreview() {
  const roles = getPreviewColors(state.colors);
  if (!roles) {
    elements.uiPreviewSection.hidden = true;
    return;
  }
  elements.uiPreviewSection.hidden = false;
  elements.previewStage.style.cssText = previewStyleProperties(roles);
  elements.previewColorDots.innerHTML = state.colors.slice(0, 6).map(color => `<i style="background:${color.hex}"></i>`).join('');
  elements.previewStage.className = `preview-stage preview-${state.previewStyle}`;
  elements.previewStage.innerHTML = state.previewStyle === 'landing'
    ? renderLandingPreview(roles)
    : state.previewStyle === 'card' ? renderCardPreview(roles) : renderDashboardPreview(roles);
}

function renderDashboardPreview(roles) {
  return `<div class="mock-window">
    <aside class="mock-sidebar"><div class="mock-logo"><span></span>northstar</div><nav><a class="active">Overview</a><a>Projects</a><a>Calendar</a><a>Settings</a></nav><div class="mock-user"><b>AM</b><span>Avery Morgan<small>Pro account</small></span></div></aside>
    <div class="mock-content"><header class="mock-topbar"><span class="mock-mobile-logo">northstar</span><div class="mock-search">Search anything <b>/</b></div><button class="mock-icon">&#9673;</button><b class="mock-avatar">AM</b></header><main><div class="mock-welcome"><div><span class="mock-kicker">Monday, October 21</span><h3>Welcome back, Avery</h3><p>Here is what is happening across your workspace.</p></div><button class="mock-button">New project <b>+</b></button></div><div class="mock-stats"><div><small>Active visitors</small><strong>2,481</strong><span class="positive">+12.8%</span></div><div><small>Projects shipped</small><strong>84</strong><span class="positive">+8.2%</span></div><div><small>Team progress</small><strong>92%</strong><span class="neutral">On track</span></div></div><div class="mock-lower"><div class="mock-chart"><div class="mock-section-title"><b>Weekly activity</b><span>Last 7 days &#8595;</span></div><div class="chart-bars">${[46, 70, 54, 88, 63, 78, 96].map((height, index) => `<i style="height:${height}%;opacity:${index === 6 ? 1 : .42 + index * .07}"></i>`).join('')}</div><div class="chart-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div><div class="mock-activity"><div class="mock-section-title"><b>Recent activity</b><span>View all</span></div><p><i></i> Brand system updated <small>2m</small></p><p><i></i> New project created <small>1h</small></p><p><i></i> Invite sent to team <small>3h</small></p></div></div></main></div>
  </div>`;
}

function renderLandingPreview(roles) {
  return `<div class="mock-window landing-window"><header class="landing-nav"><div class="mock-logo"><span></span>northstar</div><nav><a>Work</a><a>Studio</a><a>About</a></nav><button class="mock-outline">Get started <b>&#8599;</b></button></header><main class="landing-main"><span class="mock-kicker">Independent digital studio</span><h3>Ideas that move<br><em>people forward.</em></h3><p>We build thoughtful identities and digital experiences for ambitious teams with something to say.</p><button class="mock-button">Explore our work <b>&#8594;</b></button><div class="landing-features"><div><b>01</b><strong>Strategy</strong><span>Make the right thing first.</span></div><div><b>02</b><strong>Design</strong><span>Make it impossible to ignore.</span></div><div><b>03</b><strong>Systems</strong><span>Make it last and grow.</span></div></div></main><footer class="landing-footer"><span>Selected work / 2024</span><span>Scroll to discover &#8595;</span></footer></div>`;
}

function renderCardPreview(roles) {
  return `<div class="mock-window card-window"><header class="card-nav"><div class="mock-logo"><span></span>northstar</div><span>Collection 04 / 12</span><button class="mock-icon">&#8599;</button></header><main class="product-card"><div class="product-art"><span>Field<br>notes</span><i></i><b>04</b></div><div class="product-copy"><div><span class="mock-kicker">The essentials</span><h3>Make room<br>for better ideas.</h3><p>A considered collection of tools for the curious and creatively restless.</p></div><div class="product-meta"><span class="mock-tag">New collection</span><button class="mock-button">View details <b>&#8594;</b></button></div></div></main><footer class="card-footer"><span>Designed for everyday use</span><span>northstar / 2024</span></footer></div>`;
}

function renderPalette() {
  elements.paletteGrid.className = `palette-grid count-${state.colorCount}`;
  elements.paletteGrid.innerHTML = state.colors.map((color, index) => `
    <div class="color-card" style="animation-delay: ${index * 45}ms">
      <div class="swatch" style="background-color: ${color.hex}" aria-label="Color swatch ${color.hex}"></div>
      <div class="color-info">
        <button class="hex-button" type="button" data-copy-color="${color.hex}" aria-label="Copy ${color.hex}">${color.hex}</button>
        <div class="color-values">
          <button class="format-button" type="button" data-copy-color="rgb(${color.red}, ${color.green}, ${color.blue})">RGB ${color.red}, ${color.green}, ${color.blue}</button><br>
          <button class="format-button" type="button" data-copy-color="${rgbToHsl(color.red, color.green, color.blue).value}">${rgbToHsl(color.red, color.green, color.blue).label}</button>
        </div>
        <button class="copy-button" type="button" data-copy-color="${color.hex}">Copy</button>
      </div>
    </div>
  `).join('');
}

async function copyColor(hex, button) {
  const copied = await copyText(hex);
  if (!copied) return;
  const originalLabel = button.textContent;
  button.textContent = 'Copied!';
  button.classList.add('copied');
  window.setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove('copied');
  }, 1400);
}

function generateCssVariables() {
  return `:root {\n${state.colors.map((color, index) => `  --color-${index + 1}: ${color.hex};`).join('\n')}\n}`;
}

async function copyCssVariables() {
  const copied = await copyText(generateCssVariables());
  if (!copied) return;
  const label = elements.copyCssButton.querySelector('span');
  const originalLabel = label.textContent;
  label.textContent = 'Copied!';
  window.setTimeout(() => { label.textContent = originalLabel; }, 1400);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function resetApp() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.image = null;
  state.imageUrl = null;
  state.colors = [];
  elements.fileInput.value = '';
  elements.paletteGrid.innerHTML = '';
  elements.previewStage.innerHTML = '';
  elements.uiPreviewSection.hidden = true;
  elements.resultView.hidden = true;
  elements.resultContent.hidden = true;
  elements.uploadView.hidden = false;
  clearError();
}

elements.dropZone.addEventListener('click', () => elements.fileInput.click());
elements.dropZone.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); elements.fileInput.click(); }
});
elements.fileInput.addEventListener('change', event => handleFile(event.target.files[0]));
['dragenter', 'dragover'].forEach(eventName => elements.dropZone.addEventListener(eventName, event => {
  event.preventDefault();
  elements.dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach(eventName => elements.dropZone.addEventListener(eventName, event => {
  event.preventDefault();
  elements.dropZone.classList.remove('dragging');
}));
elements.dropZone.addEventListener('drop', event => handleFile(event.dataTransfer.files[0]));
elements.paletteGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-copy-color]');
  if (button) copyColor(button.dataset.copyColor, button);
});
elements.historyList.addEventListener('click', event => {
  const deleteButton = event.target.closest('[data-delete-history]');
  if (deleteButton) {
    event.stopPropagation();
    deleteHistoryItem(Number(deleteButton.dataset.deleteHistory));
    return;
  }
  const historyItem = event.target.closest('[data-history-index]');
  if (historyItem) restorePalette(Number(historyItem.dataset.historyIndex));
});
elements.historyList.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-history-index]')) {
    event.preventDefault();
    restorePalette(Number(event.target.dataset.historyIndex));
  }
});
elements.clearHistoryButton.addEventListener('click', () => { elements.historyConfirm.hidden = false; });
elements.cancelClearButton.addEventListener('click', () => { elements.historyConfirm.hidden = true; });
elements.confirmClearButton.addEventListener('click', clearPaletteHistory);
document.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => {
  state.colorCount = Number(button.dataset.count);
  document.querySelectorAll('[data-count]').forEach(item => item.classList.toggle('selected', item === button));
  if (state.image) {
    state.colors = extractColors(state.image, state.colorCount);
    renderPalette();
    renderPreview();
  }
}));
document.querySelectorAll('[data-preview-style]').forEach(button => button.addEventListener('click', () => {
  state.previewStyle = button.dataset.previewStyle;
  document.querySelectorAll('[data-preview-style]').forEach(item => item.classList.toggle('selected', item === button));
  renderPreview();
}));
elements.copyCssButton.addEventListener('click', copyCssVariables);
elements.resetButton.addEventListener('click', resetApp);
loadPaletteHistory();
