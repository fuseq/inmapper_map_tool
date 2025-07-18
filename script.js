// Global variables
let dragMode = "map";
let imgMarker = null;
let selectedImageURL = null;
let imgElement = null;
let resizeHandle = null;
let cornerMarkers = [];
let initialZoom = null;
let originalImgWidth = null;
let images = [];
let activeImageIndex = -1;
let imageScaleRatios = [];  // Her görselin zoom seviyesine göre oranını tutacak
let mapImageRatio = null; // Harita-görsel oranını tutacak


// DOM elements
const map = L.map('map').setView([39.92, 32.85], 6);
const toggleBtn = document.getElementById('toggleModeBtn');
const imageInput = document.getElementById('file-upload');
const addMarkersBtn = document.getElementById('addMarkersBtn');
const opacityRange = document.getElementById('opacityRange');
const searchBox = document.getElementById('ar-search-box');
const searchBtn = document.getElementById('ar-search-btn');
const activeImageLabel = document.getElementById('active-image-label');
const rotationRange = document.getElementById('rotationRange');
const rotationDegree = document.getElementById('rotationDegree');

// Döndürme kontrollerini devre dışı bırakalım
rotationRange.disabled = true;
rotationDegree.disabled = true;
// Prevent scroll
document.body.style.overflowY = 'hidden';

// Initialize map
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
}).addTo(map);

map.dragging.enable();

// File upload handling
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedImageURL = URL.createObjectURL(file);
    opacityRange.disabled = false;
    opacityRange.value = 1;

    // Show notification
    showNotification(`File selected: ${file.name}`, 'info');

    // Clear previous image if exists
    if (imgMarker) {
      map.removeLayer(imgMarker);
      imgMarker = null;
      toggleBtn.disabled = true;
      addMarkersBtn.disabled = true;
    }

    // Show drop indicator on map
    map.once('mouseover', () => {
      showNotification('Click on the map to place your image', 'info');
    });
  } else {
    selectedImageURL = null;
    opacityRange.disabled = true;
  }
});

// Map click handler for image placement
map.on('click', (e) => {
  if (!selectedImageURL) return;

  // Add the new image to the map
  const newImage = addNewImage(selectedImageURL, e.latlng);

  // First image mode setup
  if (images.length === 1) {
    dragMode = "object";
    map.dragging.disable();
    newImage.marker.dragging.enable();
    toggleBtn.innerHTML = '<i class="fas fa-image"></i> Mod: Image';
    toggleBtn.classList.add('btn-transition');
    setTimeout(() => toggleBtn.classList.remove('btn-transition'), 300);
  }

  // Önemli değişiklik: Bir görsel eklendiğinde seçili görsel URL'sini temizle
  selectedImageURL = null;

  // Ekleme sonrası drop indicator'ü kaldır
  const indicator = document.getElementById('drop-indicator');
  if (indicator) indicator.remove();
});

// Opacity control
opacityRange.disabled = true;
opacityRange.addEventListener('input', () => {
  if (activeImageIndex >= 0 && images[activeImageIndex]) {
    images[activeImageIndex].element.style.opacity = opacityRange.value;
  }
});

// Toggle mode button
toggleBtn.addEventListener('click', () => {
  if (activeImageIndex < 0) return;

  toggleBtn.classList.add('btn-transition');

  if (dragMode === "map") {
    dragMode = "object";
    map.dragging.disable();
    images[activeImageIndex].marker.dragging.enable();
    toggleBtn.innerHTML = '<i class="fas fa-image"></i> Mod: Image';
  } else {
    dragMode = "map";
    map.dragging.enable();
    images.forEach(img => img.marker.dragging.disable());
    toggleBtn.innerHTML = '<i class="fas fa-map"></i> Mod: Map';
  }

  setTimeout(() => {
    toggleBtn.classList.remove('btn-transition');
  }, 300);
});

// Add new image function
function addNewImage(imageUrl, latlng) {
  const wrapper = document.createElement('div');
  wrapper.className = 'draggable-img-wrapper';

  const imgElement = document.createElement('img');
  imgElement.src = imageUrl;
  imgElement.className = 'draggable-img';
  imgElement.style.opacity = opacityRange.value;

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'resize-handle';

  const closeBtn = document.createElement('div');
  closeBtn.className = 'image-close-btn';
  closeBtn.innerHTML = '&times;';

  // Döndürme tutacağı ekleyelim
  const rotateHandle = document.createElement('div');
  rotateHandle.className = 'rotation-handle';
  rotateHandle.innerHTML = '<i class="fas fa-sync-alt"></i>';

  // Döndürme kılavuzu
  const rotationGuide = document.createElement('div');
  rotationGuide.className = 'rotation-guide';
  rotationGuide.textContent = '0°';

  wrapper.appendChild(imgElement);
  wrapper.appendChild(resizeHandle);
  wrapper.appendChild(rotateHandle);
  wrapper.appendChild(rotationGuide);

  const icon = L.divIcon({
    html: wrapper,
    iconSize: [0, 0],
    className: ''
  });

  const imgMarker = L.marker(latlng, {
    icon: icon,
    draggable: true
  }).addTo(map);

  // Initial setup
  imgMarker.dragging.disable();

  // Image load handler
imgElement.onload = function() {
  const aspectRatio = this.naturalWidth / this.naturalHeight;
  
  // Görsel için uygun başlangıç boyutu
  const maxWidth = Math.min(map.getContainer().offsetWidth * 0.3, 250);
  imgElement.style.width = maxWidth + 'px';
  imgElement.style.height = (maxWidth / aspectRatio) + 'px';
  
  // Önemli: Bu değişkenleri doğru şekilde ayarlayalım
  originalImgWidth = maxWidth;
  initialZoom = map.getZoom();
  
  // imageScaleRatios dizisini güncelle
  imageScaleRatios[0] = {
    zoom: initialZoom,
    width: maxWidth,
    aspectRatio: aspectRatio
  };
  
  // Fade in animation
  imgElement.style.opacity = '0';
  setTimeout(() => {
    imgElement.style.opacity = opacityRange.value;
  }, 10);
};
  // Enable resize functionality
  enableResize(resizeHandle, imgElement);

  // Delete image handler
  closeBtn.addEventListener('click', () => {
    map.removeLayer(imgMarker);
    const index = images.findIndex(img => img.marker === imgMarker);
    if (index !== -1) {
      images.splice(index, 1);
      imageScaleRatios.splice(index, 1); // Scale ratio'yu da kaldır

      if (images.length === 0) {
        toggleBtn.disabled = true;
        addMarkersBtn.disabled = true;
        opacityRange.disabled = true;
        rotationRange.disabled = true;
        rotationDegree.disabled = true;
        activeImageIndex = -1;
        activeImageLabel.textContent = 'No active image';
      } else if (activeImageIndex === index) {
        activeImageIndex = 0;
        activateImage(activeImageIndex);
      }
    }

    showNotification('Image removed', 'info');
  });

  // Make image active on click
  wrapper.addEventListener('click', (e) => {
    if (e.target !== closeBtn) {
      const index = images.findIndex(img => img.marker === imgMarker);
      if (index !== -1) {
        activeImageIndex = index;
        activateImage(index);
      }
    }
  });

  // Store image object
  const imageObj = {
    marker: imgMarker,
    element: imgElement,
    wrapper: wrapper,
    filename: imageUrl.substring(imageUrl.lastIndexOf('/') + 1)
  };

  images.push(imageObj);

  // Her yeni görsel için zoom oranını kaydet
  const currentZoom = map.getZoom();
  imageScaleRatios.push({
    zoom: currentZoom,
    width: imgElement.offsetWidth,
    aspectRatio: imgElement.offsetWidth / imgElement.offsetHeight
  });

  activeImageIndex = images.length - 1;
  activateImage(activeImageIndex);
  enableRotation(rotateHandle, imgElement, rotationGuide);

  return imageObj;
}

function enableRotation(handle, img, guide) {
  let isRotating = false;
  let startAngle = 0;
  let currentRotation = 0;
  let initialRotation = 0;
  let totalRotation = 0; // Toplam dönüş takibi

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Döndürme sırasında marker sürüklemeyi devre dışı bırak
    if (imgMarker) imgMarker.dragging.disable();

    isRotating = true;

    // Görüntünün merkezi
    const rect = img.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Fare ile merkez arasındaki başlangıç açısı
    startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    currentRotation = getRotationDegrees(img) || 0;
    initialRotation = startAngle; // Başlangıç açısını kaydet
    totalRotation = currentRotation; // Mevcut dönüşü toplam dönüşe ata

    // Kılavuzu göster
    guide.style.display = 'block';
    guide.textContent = `${Math.round(currentRotation)}°`;

    document.addEventListener('mousemove', rotate);
    document.addEventListener('mouseup', stopRotation);
  });

  function rotate(e) {
    if (!isRotating) return;

    const rect = img.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Fare ile merkez arasındaki yeni açı
    const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    // Açı farkını hesapla (radyan)
    let angleDiff = currentAngle - startAngle;

    // 359 dereceden 0 dereceye geçişi düzgün ele al
    if (angleDiff > Math.PI) {
      angleDiff -= 2 * Math.PI;
    } else if (angleDiff < -Math.PI) {
      angleDiff += 2 * Math.PI;
    }

    // Açı farkını dereceye çevir
    const angleDiffDegrees = angleDiff * (180 / Math.PI);

    // Toplam dönüşü güncelle
    totalRotation += angleDiffDegrees;

    // Yeni açıyı görüntüye uygula (sınırlama yapmadan)
    img.style.transform = `rotate(${totalRotation}deg)`;

    // Görsel geri bildirim için açıyı 0-359 arasında göster
    const displayRotation = ((totalRotation % 360) + 360) % 360;
    guide.textContent = `${Math.round(displayRotation)}°`;

    // UI kontrollerini güncelle (0-359 arasında)
    rotationRange.value = Math.round(displayRotation);
    rotationDegree.value = Math.round(displayRotation);

    // Mevcut açıyı bir sonraki hesaplamalar için güncelle
    startAngle = currentAngle;
  }

  function stopRotation() {
    isRotating = false;

    // Kılavuzu gizle
    guide.style.display = 'none';

    // Object modunda ise marker sürüklemeyi tekrar etkinleştir
    if (imgMarker && dragMode === 'object') {
      imgMarker.dragging.enable();
    }

    document.removeEventListener('mousemove', rotate);
    document.removeEventListener('mouseup', stopRotation);
  }
}

// Activate an image
function activateImage(index) {
  if (index < 0 || index >= images.length) return;

  images.forEach((img, i) => {
    if (i === index) {
      img.wrapper.classList.add('active-image');
      imgMarker = img.marker;
      imgElement = img.element;
      activeImageLabel.textContent = `Active: Image ${index + 1}`;

      // Opacity slider ile image sync
      opacityRange.value = img.element.style.opacity || 1;
      opacityRange.disabled = false;

      // Rotation değerlerini sync et
      const currentRotation = getRotationDegrees(img.element) || 0;
      rotationRange.value = currentRotation;
      rotationDegree.value = currentRotation;
      rotationRange.disabled = false;
      rotationDegree.disabled = false;
    } else {
      img.wrapper.classList.remove('active-image');
    }
  });

  toggleBtn.disabled = false;
  addMarkersBtn.disabled = false;
}

// Resize functionality
function enableResize(handle, img) {
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  let aspectRatio;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear any existing corner markers
    cornerMarkers.forEach(marker => marker.remove());
    cornerMarkers = [];

    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = img.offsetWidth;
    startHeight = img.offsetHeight;
    aspectRatio = startWidth / startHeight;

    // Disable transitions during resize
    img.style.transition = 'none';

    // Disable marker dragging during resize
    if (imgMarker) imgMarker.dragging.disable();

    // Create resize indicator
    const resizeIndicator = document.createElement('div');
    resizeIndicator.id = 'resize-indicator';
    resizeIndicator.textContent = `${Math.round(startWidth)}×${Math.round(startHeight)}`;
    document.body.appendChild(resizeIndicator);

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  });

  function resize(e) {
    if (!isResizing) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Diagonal resize preserving aspect ratio
    const distance = Math.max(dx, dy * aspectRatio);
    const newWidth = startWidth + distance;

    if (newWidth > 50) {
      img.style.width = newWidth + 'px';
      img.style.height = (newWidth / aspectRatio) + 'px';

      // Update size indicator
      const indicator = document.getElementById('resize-indicator');
      if (indicator) {
        indicator.textContent = `${Math.round(newWidth)}×${Math.round(newWidth / aspectRatio)}`;
        indicator.style.left = (e.clientX + 15) + 'px';
        indicator.style.top = (e.clientY + 15) + 'px';
      }
    }
  }

  function stopResize() {
    isResizing = false;

    // Remove size indicator
    const indicator = document.getElementById('resize-indicator');
    if (indicator) indicator.remove();

    // Restore transitions
    img.style.transition = 'all 0.2s ease';

    // Re-enable dragging if in object mode
    if (imgMarker && dragMode === 'object') {
      imgMarker.dragging.enable();
    }

    // Güncellenen boyutları scale oranlarında kaydet
    if (activeImageIndex >= 0) {
      const currentZoom = map.getZoom();
      imageScaleRatios[activeImageIndex] = {
        zoom: currentZoom,
        width: img.offsetWidth,
        aspectRatio: img.offsetWidth / img.offsetHeight
      };
    }

    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  }
}

// Get coordinates button
addMarkersBtn.addEventListener('click', () => {
  if (activeImageIndex < 0) return;

  // İlk olarak varsa mevcut koordinat panelini kapat
  const existingCoordinatesDiv = document.getElementById('coordinatesDiv');
  if (existingCoordinatesDiv && existingCoordinatesDiv.style.display === 'block') {
    existingCoordinatesDiv.style.opacity = '0';
    setTimeout(() => {
      existingCoordinatesDiv.style.display = 'none';
    }, 500);
    cornerMarkers.forEach(marker => marker.remove());
    cornerMarkers = [];
    return;
  }

  const currentImage = images[activeImageIndex];
  const imgElement = currentImage.element;
  const imgWidth = imgElement.offsetWidth;
  const imgHeight = imgElement.offsetHeight;
  const imgMarker = currentImage.marker;

  // Calculate corner positions
  const topLeft = map.latLngToContainerPoint(imgMarker.getLatLng());
  const topRightCorner = topLeft.add([imgWidth, 0]);
  const bottomLeftCorner = topLeft.add([0, imgHeight]);
  const bottomRightCorner = topLeft.add([imgWidth, imgHeight]);

  const corners = [
    map.containerPointToLatLng(topLeft),
    map.containerPointToLatLng(topRightCorner),
    map.containerPointToLatLng(bottomRightCorner),
    map.containerPointToLatLng(bottomLeftCorner)
  ];

  // Clear previous markers
  cornerMarkers.forEach(marker => marker.remove());
  cornerMarkers = [];

  // Add corner markers
  corners.forEach((corner, index) => {
    const cornerLabel = ['TL', 'TR', 'BR', 'BL'][index];
    const marker = L.marker([corner.lat, corner.lng], {
      icon: L.divIcon({
        html: `<div style="width: 16px; height: 16px; background-color: #e74c3c; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; color: white; font-weight: bold;">${cornerLabel}</div>`,
        iconSize: [16, 16]
      })
    }).addTo(map);
    cornerMarkers.push(marker);
  });

  // Create coordinates display - Active image bilgisini kaldırdık
  const coordinatesDiv = document.getElementById('coordinatesDiv');
  coordinatesDiv.innerHTML = `
<div style="position: relative;">
  <button class="close-coords-btn"><i class="fas fa-times"></i></button>
  <strong>Coordinates:</strong>
  <div style="font-size: 12px; color: #555; line-height: 1.2;">
    <div>Top Left: (${corners[0].lat.toFixed(6)}, ${corners[0].lng.toFixed(6)})</div>
    <div>Top Right: (${corners[1].lat.toFixed(6)}, ${corners[1].lng.toFixed(6)})</div>
    <div>Bottom Right: (${corners[2].lat.toFixed(6)}, ${corners[2].lng.toFixed(6)})</div>
    <div>Bottom Left: (${corners[3].lat.toFixed(6)}, ${corners[3].lng.toFixed(6)})</div>
  </div>
  <button id="copy-coords" style="margin-top: 5px; font-size: 12px; padding: 4px 8px;">
    <i class="fas fa-copy"></i> Copy
  </button>
</div>
  `;

  // Show coordinates with animation
  coordinatesDiv.style.display = 'block';
  coordinatesDiv.style.opacity = '0';
  setTimeout(() => {
    coordinatesDiv.style.opacity = '1';
  }, 10);

  // Copy coordinates functionality
  document.getElementById('copy-coords').addEventListener('click', () => {
    const coordText = corners.map((corner, i) =>
      `${['TL', 'TR', 'BR', 'BL'][i]}: ${corner.lat.toFixed(6)}, ${corner.lng.toFixed(6)}`
    ).join('\n');

    navigator.clipboard.writeText(coordText).then(() => {
      showNotification('Coordinates copied to clipboard', 'info');
    });
  });

  // Close button for coordinates popup
  document.querySelector('.close-coords-btn').addEventListener('click', () => {
    coordinatesDiv.style.opacity = '0';
    setTimeout(() => {
      coordinatesDiv.style.display = 'none';
    }, 500);

    // Remove corner markers
    cornerMarkers.forEach(marker => marker.remove());
    cornerMarkers = [];
  });
});

// Handle search functionality (devamı)
function handleSearch(event) {
  event.preventDefault();
  const query = searchBox.value.trim();
  if (!query) return;

  // Update search button to show loading state
  searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  searchBtn.disabled = true;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        // Fly to location with animation
        map.flyTo([lat, lon], 16, {
          duration: 1.5,
          easeLinearity: 0.5
        });

        showNotification(`Location found: ${data[0].display_name.split(',')[0]}`, 'info');
      } else {
        showNotification('Location not found', 'error');
      }
    })
    .catch(err => {
      console.error('Search error:', err);
      showNotification('An error occurred', 'error');
    })
    .finally(() => {
      // Restore search button
      searchBtn.innerHTML = '<i class="fas fa-search"></i>';
      searchBtn.disabled = false;
    });
}

// Show notification
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(note => note.remove());

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Map drop indicator
map.on('mousemove', (e) => {
  if (selectedImageURL) {
    if (!document.getElementById('drop-indicator')) {
      const indicator = document.createElement('div');
      indicator.id = 'drop-indicator';
      indicator.innerHTML = '<i class="fas fa-plus"></i>';
      document.body.appendChild(indicator);
    }

    const indicator = document.getElementById('drop-indicator');
    if (indicator) {
      indicator.style.left = e.originalEvent.clientX + 'px';
      indicator.style.top = e.originalEvent.clientY + 'px';
    }
  } else {
    // Eğer seçili görsel yoksa göstergeyi kaldır
    const indicator = document.getElementById('drop-indicator');
    if (indicator) indicator.remove();
  }
});

// Handle zoom to scale images proportionally
map.on('zoom', () => {
  if (images.length === 0) return;

  const currentZoom = map.getZoom();
  
  images.forEach((img, index) => {
    if (img.element && imageScaleRatios[index]) {
      const scaleData = imageScaleRatios[index];
      const zoomDiff = currentZoom - scaleData.zoom;
      const scaleFactor = Math.pow(2, zoomDiff);
      
      // Orijinal boyutun zoom seviyesine göre ölçeklendirilmesi
      const newWidth = scaleData.width * scaleFactor;
      
      // Minimum boyut kontrolü ekleyelim
      const minWidth = 30;
      const actualWidth = Math.max(newWidth, minWidth);
      
      img.element.style.width = actualWidth + 'px';
      img.element.style.height = (actualWidth / scaleData.aspectRatio) + 'px';
    }
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (activeImageIndex >= 0) {
    const activeImage = images[activeImageIndex];

    // Delete active image with Delete key
    if (e.key === 'Delete') {
      map.removeLayer(activeImage.marker);
      images.splice(activeImageIndex, 1);
      imageScaleRatios.splice(activeImageIndex, 1); // Scale ratio'yu da kaldır

      if (images.length === 0) {
        toggleBtn.disabled = true;
        addMarkersBtn.disabled = true;
        opacityRange.disabled = true;
        rotationRange.disabled = true;
        rotationDegree.disabled = true;
        activeImageIndex = -1;
        activeImageLabel.textContent = 'No active image';
      } else {
        activeImageIndex = Math.min(activeImageIndex, images.length - 1);
        activateImage(activeImageIndex);
      }

      showNotification('Image removed', 'info');
    }

    // Toggle modes with M key
    if (e.key === 'm' || e.key === 'M') {
      toggleBtn.click();
    }

    // Get coordinates with C key
    if (e.key === 'c' || e.key === 'C') {
      addMarkersBtn.click();
    }

    // Arrow keys to nudge active image (when in image mode)
    if (dragMode === 'object' && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();

      const latlng = activeImage.marker.getLatLng();
      const pixelDist = e.shiftKey ? 10 : 1;
      const point = map.latLngToContainerPoint(latlng);

      if (e.key === 'ArrowUp') {
        point.y -= pixelDist;
      } else if (e.key === 'ArrowDown') {
        point.y += pixelDist;
      } else if (e.key === 'ArrowLeft') {
        point.x -= pixelDist;
      } else if (e.key === 'ArrowRight') {
        point.x += pixelDist;
      }

      const newLatLng = map.containerPointToLatLng(point);
      activeImage.marker.setLatLng(newLatLng);
    }
  }

  // Escape key to close coordinatesDiv
  if (e.key === 'Escape') {
    const coordinatesDiv = document.getElementById('coordinatesDiv');
    if (coordinatesDiv.style.display === 'block') {
      coordinatesDiv.style.opacity = '0';
      setTimeout(() => {
        coordinatesDiv.style.display = 'none';
      }, 500);

      // Remove corner markers
      cornerMarkers.forEach(marker => marker.remove());
      cornerMarkers = [];
    }
  }
});

// Double click to rotate image
document.addEventListener('dblclick', (e) => {
  if (activeImageIndex >= 0 && e.target.classList.contains('draggable-img')) {
    e.preventDefault();
    e.stopPropagation();

    const img = e.target;
    const currentRotation = getRotationDegrees(img) || 0;
    const newRotation = (currentRotation + 90) % 360;

    img.style.transform = `rotate(${newRotation}deg)`;

    // Show rotation notification
    showNotification(`Rotated to ${newRotation}°`, 'info');
  }
});

// Helper function to get current rotation
function getRotationDegrees(element) {
  const style = window.getComputedStyle(element);
  const transform = style.getPropertyValue('transform');

  if (transform === 'none') return 0;

  const matrix = transform.match(/^matrix\((.+)\)$/);
  if (!matrix) return 0;

  const values = matrix[1].split(',');
  const a = parseFloat(values[0]);
  const b = parseFloat(values[1]);

  return Math.round(Math.atan2(b, a) * (180 / Math.PI));
}

// Layer control - sağ alta taşındı
const baseMaps = {
  "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'
  }),
  "Streets": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }),
  "Terrain": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri — Source: Esri, USGS, and the GIS User Community'
  })
};

// Add layer control with satellite as default
baseMaps["Satellite"].addTo(map);
L.control.layers(baseMaps, null, { position: 'bottomright' }).addTo(map);

// Touch support for mobile devices
let touchStartX, touchStartY;

document.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1 && e.target.classList.contains('draggable-img') && dragMode === 'object') {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }
});

document.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && touchStartX !== undefined && touchStartY !== undefined && activeImageIndex >= 0 && dragMode === 'object') {
    e.preventDefault();

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    const latlng = images[activeImageIndex].marker.getLatLng();
    const point = map.latLngToContainerPoint(latlng);
    point.x += dx;
    point.y += dy;

    const newLatLng = map.containerPointToLatLng(point);
    images[activeImageIndex].marker.setLatLng(newLatLng);

    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }
});

document.addEventListener('touchend', () => {
  touchStartX = undefined;
  touchStartY = undefined;
});

function saveSettings() {
  const settings = {
    lastPosition: map.getCenter(),
    lastZoom: map.getZoom(),
    lastBaseMap: Object.keys(baseMaps).find(key => map.hasLayer(baseMaps[key]))
  };

  localStorage.setItem('mapSettings', JSON.stringify(settings));
}

map.on('moveend', saveSettings);
map.on('baselayerchange', saveSettings);

try {
  const savedSettings = JSON.parse(localStorage.getItem('mapSettings'));
  if (savedSettings) {
    if (savedSettings.lastPosition) {
      map.setView([savedSettings.lastPosition.lat, savedSettings.lastPosition.lng],
        savedSettings.lastZoom || 6);
    }

    if (savedSettings.lastBaseMap && baseMaps[savedSettings.lastBaseMap]) {
      Object.values(baseMaps).forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });

      baseMaps[savedSettings.lastBaseMap].addTo(map);
    }
  }
} catch (e) {
  console.error('Error loading saved settings:', e);
}

rotationRange.addEventListener('input', () => {
  if (activeImageIndex >= 0 && images[activeImageIndex]) {
    const newRotation = parseInt(rotationRange.value);
    rotationDegree.value = newRotation;
    rotateActiveImage(newRotation);
  }
});

rotationDegree.addEventListener('input', () => {
  if (activeImageIndex >= 0 && images[activeImageIndex]) {
    let newRotation = parseInt(rotationDegree.value);

    // Değerin 0-359 arasında olduğundan emin olalım
    if (isNaN(newRotation)) newRotation = 0;
    if (newRotation < 0) newRotation = 0;
    if (newRotation > 359) newRotation = 359;

    rotationRange.value = newRotation;
    rotateActiveImage(newRotation);
  }
});

// Aktif görüntüyü döndürme fonksiyonu
function rotateActiveImage(degrees) {
  if (activeImageIndex >= 0 && images[activeImageIndex]) {
    const img = images[activeImageIndex].element;
    img.style.transform = `rotate(${degrees}deg)`;

    // Eğer varsa döndürme kılavuzunu güncelle
    const guide = document.querySelector('.rotation-guide');
    if (guide) {
      guide.textContent = `${degrees}°`;
    }
  }
}