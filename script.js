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
let coordinateMode = false; // Koordinat modu aktif mi?
let clickMarker = null; // Koordinat için tıklanan noktayı işaretlemek için
let imageHistory = []; // Her görsel için değişiklik geçmişi
let actionHistory = []; // Yapılan işlemlerin geçmişi
let lastActionTime = 0; // Son işlem zamanı (debounce için)
let isUndoOperation = false; // Geri alma işlemi sırasında yeni kayıt oluşturmayı engellemek için// DOM elements
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
const getCoordinateModeBtn = document.getElementById('getCoordinateModeBtn');
const undoBtn = document.getElementById('undoBtn');

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
});// Map click handler for image placement
map.on('click', (e) => {
  // Koordinat modu aktifse, tıklanan noktanın koordinatlarını göster
  if (coordinateMode) {
    showClickCoordinates(e.latlng);
    return;
  }
  
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

  // Görsel eklendiğinde bir "add" işlemi olarak kaydet
  if (!isUndoOperation) {
    recordAction('add', images.length - 1, {
      latLng: e.latlng,
      imageURL: selectedImageURL
    });
  }

  // Önemli değişiklik: Bir görsel eklendiğinde seçili görsel URL'sini temizle
  selectedImageURL = null;

  // Ekleme sonrası drop indicator'ü kaldır
  const indicator = document.getElementById('drop-indicator');
  if (indicator) indicator.remove();
  
  updateUndoButtonState();
});

// Koordinat modu butonu
getCoordinateModeBtn.addEventListener('click', () => {
  coordinateMode = !coordinateMode;
  
  if (coordinateMode) {
    getCoordinateModeBtn.classList.add('active-mode');
    getCoordinateModeBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Exit Point lat/lon ';
    showNotification('Click anywhere on the map to get coordinates', 'info');
  } else {
    getCoordinateModeBtn.classList.remove('active-mode');
    getCoordinateModeBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Point lat/lon';
    
    // Varsa işaretleme ve koordinat panelini kaldır
    if (clickMarker) {
      map.removeLayer(clickMarker);
      clickMarker = null;
    }
    
    const coordinatesDiv = document.getElementById('coordinatesDiv');
    if (coordinatesDiv && coordinatesDiv.style.display === 'block') {
      coordinatesDiv.style.opacity = '0';
      setTimeout(() => {
        coordinatesDiv.style.display = 'none';
      }, 500);
    }
  }
});

// Tıklanan koordinatları gösterme fonksiyonu
function showClickCoordinates(latlng) {
  // Varsa önceki işaretçiyi kaldır
  if (clickMarker) {
    map.removeLayer(clickMarker);
  }
  
  // Tıklanan noktayı işaretle
  clickMarker = L.marker(latlng, {
    icon: L.divIcon({
      html: `<div style="width: 16px; height: 16px; background-color: #e74c3c; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;"></div>`,
      iconSize: [16, 16]
    })
  }).addTo(map);// Koordinat panelini göster
  const coordinatesDiv = document.getElementById('coordinatesDiv');
  coordinatesDiv.innerHTML = `
    <div style="position: relative;">
      <button class="close-coords-btn"><i class="fas fa-times"></i></button>
      <strong>Clicked Coordinates:</strong>
      <div style="font-size: 14px; color: #555; line-height: 1.4; margin: 8px 0;">
        <div>Latitude: ${latlng.lat.toFixed(6)}</div>
        <div>Longitude: ${latlng.lng.toFixed(6)}</div>
      </div>
      <button id="copy-click-coords" style="width: 100%; padding: 8px 12px; margin-top: 1px; border: none; border-radius: 5px; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <i class="fas fa-copy"></i> Copy
      </button>
    </div>
  `;
  
  // Paneli göster
  coordinatesDiv.style.display = 'block';
  coordinatesDiv.style.opacity = '0';
  setTimeout(() => {
    coordinatesDiv.style.opacity = '1';
  }, 10);
  
  // Kopyalama butonu
  document.getElementById('copy-click-coords').addEventListener('click', () => {
    const coordText = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    navigator.clipboard.writeText(coordText).then(() => {
      showNotification('Coordinates copied to clipboard', 'info');
    });
  });
  
  // Kapatma butonu
  document.querySelector('.close-coords-btn').addEventListener('click', () => {
    coordinatesDiv.style.opacity = '0';
    setTimeout(() => {
      coordinatesDiv.style.display = 'none';
    }, 500);
    
    // İşaretçiyi kaldır
    if (clickMarker) {
      map.removeLayer(clickMarker);
      clickMarker = null;
    }
  });
}// Opacity control
opacityRange.disabled = true;
opacityRange.addEventListener('input', () => {
  if (activeImageIndex >= 0 && images[activeImageIndex]) {
    // Değişiklikten önce görüntünün mevcut durumunu kaydet
    if (!isUndoOperation) {
      const oldOpacity = images[activeImageIndex].element.style.opacity || "1";
      recordAction('opacity', activeImageIndex, {
        oldValue: oldOpacity,
        newValue: opacityRange.value
      });
    }
    
    // Opaklığı güncelle
    images[activeImageIndex].element.style.opacity = opacityRange.value;
  }
});

// Yalnızca değişikliğin tamamlandığını kaydetmek için input değil change olayını dinle
opacityRange.addEventListener('change', () => {
  updateUndoButtonState();































});// Toggle mode button
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
  imgElement.style.opacity = opacityRange.value;// Dört köşe için boyutlandırma tutamaçları oluştur
  const resizeHandleNW = document.createElement('div');
  resizeHandleNW.className = 'resize-handle resize-handle-nw';
  
  const resizeHandleNE = document.createElement('div');
  resizeHandleNE.className = 'resize-handle resize-handle-ne';
  
  const resizeHandleSW = document.createElement('div');
  resizeHandleSW.className = 'resize-handle resize-handle-sw';
  
  const resizeHandleSE = document.createElement('div');
  resizeHandleSE.className = 'resize-handle resize-handle-se';

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
  rotationGuide.textContent = '0°';wrapper.appendChild(imgElement);
  wrapper.appendChild(resizeHandleNW);
  wrapper.appendChild(resizeHandleNE);
  wrapper.appendChild(resizeHandleSW);
  wrapper.appendChild(resizeHandleSE);
  wrapper.appendChild(rotateHandle);
  wrapper.appendChild(rotationGuide);

  const icon = L.divIcon({
    html: wrapper,
    iconSize: [0, 0],
    className: ''
  });const imgMarker = L.marker(latlng, {
    icon: icon,
    draggable: true
  }).addTo(map);
  
  // Sürükleme başlangıç ve bitiş olaylarını dinle
  let startLatLng;
  
  imgMarker.on('dragstart', function(e) {
    // Sürüklemeye başlangıç konumunu kaydet
    startLatLng = imgMarker.getLatLng();
  });
  
  imgMarker.on('dragend', function(e) {
    // Sürükleme bittiğinde eski ve yeni konumu karşılaştır
    const endLatLng = imgMarker.getLatLng();
    
    // Konum değiştiyse ve geri alma işlemi değilse kaydet
    if (!isUndoOperation && startLatLng &&
        (startLatLng.lat !== endLatLng.lat || startLatLng.lng !== endLatLng.lng)) {
      
      const currentImgIndex = images.findIndex(img => img.marker === imgMarker);
      if (currentImgIndex !== -1) {
        recordAction('move', currentImgIndex, {
          oldValue: L.latLng(startLatLng.lat, startLatLng.lng),
          newValue: L.latLng(endLatLng.lat, endLatLng.lng)
        });
        updateUndoButtonState();
      }
    }
  });

  // Initial setup
  imgMarker.dragging.disable();// Image load handler
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
  
  // Yeni görsel eklendiğinde geri al butonunu güncelle
  updateUndoButtonState();
};// Enable resize functionality for all handles
  enableResize(resizeHandleNW, imgElement, 'nw');
  enableResize(resizeHandleNE, imgElement, 'ne');
  enableResize(resizeHandleSW, imgElement, 'sw');
  enableResize(resizeHandleSE, imgElement, 'se');

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
}function enableRotation(handle, img, guide) {
  let isRotating = false;
  let startAngle = 0;
  let currentRotation = 0;
  let initialRotation = 0;
  let totalRotation = 0; // Toplam dönüş takibi
  let rotationStartValue = 0; // Döndürmeye başlarken mevcut değeri kaydet

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
    rotationStartValue = currentRotation; // Başlangıç değerini kaydet (undo için)

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
    if (!isRotating) return;
    
    // İşlem geçmişine kaydet
    const currentImgIndex = images.findIndex(imgObj => imgObj.element === img);
    if (currentImgIndex !== -1 && !isUndoOperation) {
      const finalRotation = getRotationDegrees(img);
      if (finalRotation !== rotationStartValue) {
        recordAction('rotation', currentImgIndex, {
          oldValue: rotationStartValue,
          newValue: finalRotation
        });
      }
    }
    
    isRotating = false;

    // Kılavuzu gizle
    guide.style.display = 'none';

    // Object modunda ise marker sürüklemeyi tekrar etkinleştir
    if (imgMarker && dragMode === 'object') {
      imgMarker.dragging.enable();
    }

    document.removeEventListener('mousemove', rotate);
    document.removeEventListener('mouseup', stopRotation);
    
    updateUndoButtonState();
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
  });toggleBtn.disabled = false;
  addMarkersBtn.disabled = false;
  saveSettingsBtn.disabled = false;
























































































}// Resize functionality
function enableResize(handle, img, corner) {
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  let aspectRatio;
  let originalSize = {}; // Boyut değişikliği başlangıcında orijinal boyutları saklayacak

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

    // Orijinal boyutları kaydet
    originalSize = {
      width: startWidth,
      height: startHeight
    };

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
    
    // Tüm köşeler için aynı boyutlandırma mantığı kullanalım
    // Orijinal SE (sağ alt) köşe davranışını koruyalım
    const distance = Math.max(dx, dy * aspectRatio);
    const newWidth = Math.max(50, startWidth + distance);
    
    img.style.width = newWidth + 'px';
    img.style.height = (newWidth / aspectRatio) + 'px';

    // Update size indicator
    const indicator = document.getElementById('resize-indicator');
    if (indicator) {
      indicator.textContent = `${Math.round(newWidth)}×${Math.round(newWidth / aspectRatio)}`;
      indicator.style.left = (e.clientX + 15) + 'px';
      indicator.style.top = (e.clientY + 15) + 'px';
    }
  }function stopResize() {
    if (!isResizing) return;
    
    // İşlem geçmişine kaydet
    const currentImgIndex = images.findIndex(imgObj => imgObj.element === img);
    if (currentImgIndex !== -1 && !isUndoOperation) {
      const newSize = {
        width: img.offsetWidth,
        height: img.offsetHeight
      };
      
      // Yalnızca boyut değiştiyse kaydet
      if (originalSize.width !== newSize.width || originalSize.height !== newSize.height) {
        recordAction('resize', currentImgIndex, {
          oldValue: originalSize,
          newValue: newSize
        });
      }
    }
    
    isResizing = false;

    // Remove size indicator
    const indicator = document.getElementById('resize-indicator');
    if (indicator) indicator.remove();

    // Restore transitions
    img.style.transition = 'all 0.2s ease';
    
    // Uygulanan marjinleri sıfırla ve konumu ayarla
    if (img.style.marginLeft || img.style.marginTop) {
      // Görselin yeni konumunu harita üzerinde hesapla
      const imgRect = img.getBoundingClientRect();
      const wrapperRect = img.parentElement.getBoundingClientRect();
      
      // Leaflet marker'ı için yeni konum hesapla
      if (imgMarker) {
        const currentPoint = map.latLngToContainerPoint(imgMarker.getLatLng());
        
        // Margin değerlerini hesapla
        const leftMargin = parseFloat(img.style.marginLeft || 0);
        const topMargin = parseFloat(img.style.marginTop || 0);
        
        // Yeni noktayı hesapla
        const newPoint = L.point(
          currentPoint.x + leftMargin / 2, 
          currentPoint.y + topMargin / 2
        );
        
        // Yeni koordinatları ayarla
        const newLatLng = map.containerPointToLatLng(newPoint);
        imgMarker.setLatLng(newLatLng);
      }
      
      // Marjinleri sıfırla
      img.style.marginLeft = '0px';
      img.style.marginTop = '0px';
    }

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
    
    updateUndoButtonState();
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
  });// Close button for coordinates popup
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

// Undo butonu işlevselliği
undoBtn.addEventListener('click', () => {
  undoLastAction();
});

// Geri alma işlevselliği için Ctrl+Z kısayolu
document.addEventListener('keydown', (e) => {
  // Windows/Linux için Ctrl+Z, Mac için Cmd+Z
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault(); // Tarayıcının varsayılan geri alma davranışını engelle
    undoLastAction();
  }
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
    const activeImage = images[activeImageIndex];// Delete active image with Delete key
    if (e.key === 'Delete') {
      // Silme işlemini kaydet
      if (!isUndoOperation) {
        const deletedImage = {
          marker: activeImage.marker,
          element: activeImage.element,
          wrapper: activeImage.wrapper,
          latLng: activeImage.marker.getLatLng(),
          width: activeImage.element.offsetWidth,
          height: activeImage.element.offsetHeight,
          opacity: activeImage.element.style.opacity || "1",
          rotation: getRotationDegrees(activeImage.element),
          imageURL: activeImage.element.src,
          filename: activeImage.filename
        };
        
        recordAction('delete', activeImageIndex, {
          imageData: deletedImage
        });
      }
    
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
      updateUndoButtonState();
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
});// Helper function to get current rotation
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

// İşlem geçmişine ekleme yapan fonksiyon
function recordAction(actionType, imageIndex, actionData) {
  // Debounce için 100ms kontrol
  const now = Date.now();
  if (now - lastActionTime < 100 && actionHistory.length > 0 && 
      actionHistory[actionHistory.length - 1].type === actionType &&
      actionHistory[actionHistory.length - 1].imageIndex === imageIndex) {
    return; // Çok hızlı ardışık aynı işlemleri engelle
  }
  
  actionHistory.push({
    type: actionType,
    imageIndex: imageIndex,
    data: actionData,
    timestamp: now
  });
  
  // Geçmişi çok uzun tutmamak için sınırlayalım
  if (actionHistory.length > 50) {
    actionHistory.shift(); // En eski işlemi çıkar
  }
  
  lastActionTime = now;
  updateUndoButtonState();
}

// Geri al butonunun durumunu güncelle
function updateUndoButtonState() {
  if (actionHistory.length > 0) {
    undoBtn.disabled = false;
    undoBtn.innerHTML = `<i class="fas fa-undo"></i> Undo ${getActionName(actionHistory[actionHistory.length - 1].type)}`;
  } else {
    undoBtn.disabled = true;
    undoBtn.innerHTML = '<i class="fas fa-undo"></i> Undo';
  }
}

// İşlem tipini okunabilir metne çevir
function getActionName(actionType) {
  switch(actionType) {
    case 'add': return 'Add';
    case 'delete': return 'Delete';
    case 'resize': return 'Resize';
    case 'rotation': return 'Rotation';
    case 'opacity': return 'Opacity';
    case 'move': return 'Move';
    case 'toggleMode': return 'Mode Change';
    default: return 'Action';
  }
}

// Son işlemi geri al
function undoLastAction() {
  if (actionHistory.length === 0) return;
  
  const lastAction = actionHistory.pop();
  isUndoOperation = true; // İşlem sırasında yeni kayıt oluşturulmasını engelle
  
  try {
    switch(lastAction.type) {
      case 'add':
        undoAddImage(lastAction);
        break;
      case 'delete':
        undoDeleteImage(lastAction);
        break;
      case 'resize':
        undoResizeImage(lastAction);
        break;
      case 'rotation':
        undoRotateImage(lastAction);
        break;
      case 'opacity':
        undoOpacityChange(lastAction);
        break;
      case 'move':
        undoMoveImage(lastAction);
        break;
      case 'toggleMode':
        undoToggleMode(lastAction);
        break;
    }
    
    showNotification(`Undid ${getActionName(lastAction.type)}`, 'info');
  } catch (error) {
    console.error('Error during undo operation:', error);
    showNotification('Could not undo last action', 'error');
  } finally {
    isUndoOperation = false;
    updateUndoButtonState();
  }
}

// Görsel ekleme işlemini geri al
function undoAddImage(action) {
  if (action.imageIndex >= 0 && action.imageIndex < images.length) {
    const image = images[action.imageIndex];
    map.removeLayer(image.marker);
    images.splice(action.imageIndex, 1);
    imageScaleRatios.splice(action.imageIndex, 1);
    
    if (images.length === 0) {
      toggleBtn.disabled = true;
      addMarkersBtn.disabled = true;
      saveSettingsBtn.disabled = true;
      opacityRange.disabled = true;
      rotationRange.disabled = true;
      rotationDegree.disabled = true;
      activeImageIndex = -1;
      activeImageLabel.textContent = 'No active image';
    } else {
      activeImageIndex = Math.min(action.imageIndex, images.length - 1);
      activateImage(activeImageIndex);
    }
  }
}

// Görsel silme işlemini geri al
function undoDeleteImage(action) {
  const deletedImageData = action.data.imageData;
  
  // URL'den görsel oluştur
  const imageUrl = deletedImageData.imageURL;
  
  // Görsel için yapıcı parametreleri oluştur
  const imgSettings = {
    lat: deletedImageData.latLng.lat,
    lng: deletedImageData.latLng.lng,
    width: deletedImageData.width,
    height: deletedImageData.height,
    opacity: deletedImageData.opacity,
    rotation: deletedImageData.rotation,
    filename: deletedImageData.filename
  };
  
  // Görseli tekrar oluştur
  createImageWithSettings(imageUrl, imgSettings, () => {
    // İndeks bilgisini düzelt
    if (action.imageIndex < images.length) {
      // Görseli doğru konuma taşı
      const temp = images.pop();
      images.splice(action.imageIndex, 0, temp);
      
      const tempScale = imageScaleRatios.pop();
      imageScaleRatios.splice(action.imageIndex, 0, tempScale);
    }
    
    activeImageIndex = action.imageIndex;
    activateImage(activeImageIndex);
  });
}

// Boyut değiştirme işlemini geri al
function undoResizeImage(action) {
  if (action.imageIndex >= 0 && action.imageIndex < images.length) {
    const img = images[action.imageIndex].element;
    const oldSize = action.data.oldValue;
    
    // Eski boyutu geri yükle
    img.style.width = oldSize.width + 'px';
    img.style.height = oldSize.height + 'px';
    
    // Scale ratio'yu güncelle
    imageScaleRatios[action.imageIndex] = {
      zoom: map.getZoom(),
      width: oldSize.width,
      aspectRatio: oldSize.width / oldSize.height
    };
    
    activeImageIndex = action.imageIndex;
    activateImage(action.imageIndex);
  }
}

// Döndürme işlemini geri al
function undoRotateImage(action) {
  if (action.imageIndex >= 0 && action.imageIndex < images.length) {
    const img = images[action.imageIndex].element;
    const oldRotation = action.data.oldValue;
    
    // Eski açıyı geri yükle
    img.style.transform = `rotate(${oldRotation}deg)`;
    
    // UI kontrollerini güncelle
    rotationRange.value = oldRotation;
    rotationDegree.value = oldRotation;
    
    activeImageIndex = action.imageIndex;
    activateImage(action.imageIndex);
  }
}

// Opaklık değişikliğini geri al
function undoOpacityChange(action) {
  if (action.imageIndex >= 0 && action.imageIndex < images.length) {
    const img = images[action.imageIndex].element;
    const oldOpacity = action.data.oldValue;
    
    // Eski opaklığı geri yükle
    img.style.opacity = oldOpacity;
    
    // UI kontrolünü güncelle
    opacityRange.value = oldOpacity;
    
    activeImageIndex = action.imageIndex;
    activateImage(action.imageIndex);
  }
}

// Konum değişikliğini geri al
function undoMoveImage(action) {
  if (action.imageIndex >= 0 && action.imageIndex < images.length) {
    const marker = images[action.imageIndex].marker;
    const oldLatLng = action.data.oldValue;
    
    // Eski konumu geri yükle
    marker.setLatLng(oldLatLng);
    
    activeImageIndex = action.imageIndex;
    activateImage(action.imageIndex);
  }
}

// Mod değişikliğini geri al
function undoToggleMode(action) {
  const oldMode = action.data.oldValue;
  
  if (dragMode !== oldMode) {
    // Eski modu geri yükle
    if (oldMode === "map") {
      dragMode = "map";
      map.dragging.enable();
      images.forEach(img => img.marker.dragging.disable());
      toggleBtn.innerHTML = '<i class="fas fa-map"></i> Mod: Map';
    } else {
      dragMode = "object";
      map.dragging.disable();
      if (activeImageIndex >= 0) {
        images[activeImageIndex].marker.dragging.enable();
      }
      toggleBtn.innerHTML = '<i class="fas fa-image"></i> Mod: Image';
    }
  }
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
  }} catch (e) {
  console.error('Error loading saved settings:', e);
}

// Layout kaydetme ve yükleme işlevleri
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const loadSettingsBtn = document.getElementById('loadSettingsBtn');
const layoutsModal = document.getElementById('layoutsModal');
const savedLayoutsList = document.getElementById('savedLayoutsList');
const noLayoutsMessage = document.querySelector('.no-layouts-message');
const closeModalBtn = document.querySelector('.close-modal');

// Layout ayarlarını kaydetme işlevi
saveSettingsBtn.addEventListener('click', () => {
  if (images.length === 0) {
    showNotification('No images to save', 'error');
    return;
  }

  // Kullanıcıdan layout adını al
  const layoutName = prompt('Enter a name for this layout:', `Layout ${new Date().toLocaleDateString()}`);
  if (!layoutName) return;

  // Mevcut görsellerin ayarlarını topla
  const imageSettings = images.map(img => {
    const element = img.element;
    const marker = img.marker;
    const latlng = marker.getLatLng();
    const rotation = getRotationDegrees(element);
    
    return {
      url: element.src,
      lat: latlng.lat,
      lng: latlng.lng,
      width: element.offsetWidth,
      height: element.offsetHeight,
      opacity: parseFloat(element.style.opacity || '1'),
      rotation: rotation,
      filename: img.filename || 'image'
    };
  });

  // Mevcut harita ayarlarını al
  const mapSettings = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    baseMap: Object.keys(baseMaps).find(key => map.hasLayer(baseMaps[key]))
  };

  // Tüm ayarları tek bir obje içinde topla
  const layoutSettings = {
    name: layoutName,
    date: new Date().toISOString(),
    images: imageSettings,
    map: mapSettings
  };

  // localStorage'dan mevcut ayarları al
  let savedLayouts = JSON.parse(localStorage.getItem('savedLayouts') || '[]');
  
  // Yeni layout'u ekle
  savedLayouts.push(layoutSettings);
  
  // localStorage'a kaydet
  localStorage.setItem('savedLayouts', JSON.stringify(savedLayouts));
  
  showNotification(`Layout "${layoutName}" saved successfully`, 'info');
});

// Kaydedilen layout'ları yükleme/listeleme
loadSettingsBtn.addEventListener('click', () => {
  // localStorage'dan layout'ları al
  const savedLayouts = JSON.parse(localStorage.getItem('savedLayouts') || '[]');
  
  // Layout listesini temizle
  savedLayoutsList.innerHTML = '';
  
  if (savedLayouts.length === 0) {
    // Hiç layout yoksa mesajı göster
    noLayoutsMessage.style.display = 'block';
  } else {
    // Layout'ları listele
    noLayoutsMessage.style.display = 'none';
    
    savedLayouts.forEach((layout, index) => {
      const date = new Date(layout.date);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      
      const layoutItem = document.createElement('div');
      layoutItem.className = 'layout-item';layoutItem.innerHTML = `
        <div class="layout-info">
          <div class="layout-name">${layout.name}</div>
          <div class="layout-date">${formattedDate} | ${layout.images.length} image${layout.images.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="layout-actions">
          <button class="load-layout-btn" data-index="${index}" title="Load this layout">
            <i class="fas fa-check"></i>
          </button>
          <button class="delete-layout-btn" data-index="${index}" title="Delete this layout">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      
      savedLayoutsList.appendChild(layoutItem);
    });
    
    // Load butonlarına event listener ekle
    document.querySelectorAll('.load-layout-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        loadLayout(savedLayouts[index]);
        layoutsModal.style.display = 'none';
      });
    });
    
    // Delete butonlarına event listener ekle
    document.querySelectorAll('.delete-layout-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        if (confirm(`Are you sure you want to delete layout "${savedLayouts[index].name}"?`)) {
          savedLayouts.splice(index, 1);
          localStorage.setItem('savedLayouts', JSON.stringify(savedLayouts));
          loadSettingsBtn.click(); // Listeyi yenile
          showNotification('Layout deleted', 'info');
        }
      });
    });
  }
  
  // Modal'ı göster
  layoutsModal.style.display = 'block';
});

// Modal'ı kapatma
closeModalBtn.addEventListener('click', () => {
  layoutsModal.style.display = 'none';
});

// Modal dışına tıklayınca kapatma
window.addEventListener('click', (e) => {
  if (e.target === layoutsModal) {
    layoutsModal.style.display = 'none';
  }
});// Layout'u yükleme fonksiyonu
function loadLayout(layout) {
  // Mevcut görselleri temizle
  clearAllImages();
  
  // Harita ayarlarını uygula
  if (layout.map) {
    map.setView([layout.map.center.lat, layout.map.center.lng], layout.map.zoom);
    
    // Harita katmanını değiştir
    if (layout.map.baseMap && baseMaps[layout.map.baseMap]) {
      Object.values(baseMaps).forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
      
      baseMaps[layout.map.baseMap].addTo(map);
    }
  }// Seçili görsel URL'sini sıfırla
  selectedImageURL = null;
  
  // Görsel ekleme indikatörünü kaldır
  const indicator = document.getElementById('drop-indicator');
  if (indicator) indicator.remove();
  
  // Görselleri ekle
  if (layout.images && layout.images.length > 0) {
    // Sıralı ekleme için her bir görsel için ayarları saklayalım
    let pendingImages = [...layout.images];
    
    // İlk görseli eklemek için fonksiyonu çağır
    loadNextImage(pendingImages);
  }
}

// Sırayla görselleri yükleme fonksiyonu
function loadNextImage(pendingImages) {
  if (pendingImages.length === 0) {
    showNotification('All images placed successfully', 'info');
    return;
  }
  
  // Sıradaki görsel ayarlarını al
  const imgSettings = pendingImages[0];
  
  // Kullanıcıyı bilgilendir
  showNotification(`Please select file: ${imgSettings.filename}`, 'info');
  
  // Dosya seçimi için bir kez dinle
  const fileInput = document.getElementById('file-upload');
  
  const fileListener = function(e) {
    const file = e.target.files[0];if (file) {
      const imageUrl = URL.createObjectURL(file);
      
      // selectedImageURL'i temizle, böylece normal ekleme tetiklenmez
      selectedImageURL = null;
      
      // Görsel ekleme indikatörünü kaldır
      const indicator = document.getElementById('drop-indicator');
      if (indicator) indicator.remove();
      
      // Özel bir fonksiyon kullanarak görseli oluştur ve ayarlarını uygula
      createImageWithSettings(imageUrl, imgSettings, () => {
        // İşlem tamamlandıktan sonra bildirim göster
        showNotification(`Image "${file.name}" placed successfully`, 'info');
        
        // Bu görseli listeden kaldır ve bir sonrakine geç
        pendingImages.shift();
        
        // Kalan görselleri kontrol et
        if (pendingImages.length > 0) {
          setTimeout(() => {
            loadNextImage(pendingImages);
          }, 500); // Sonraki görsel için biraz bekle
        } else {
          showNotification('All images placed successfully', 'info');
        }
      });
    }
    
    // Event listener'ı kaldır (tek kullanımlık)
    fileInput.removeEventListener('change', fileListener);
  };
  
  fileInput.addEventListener('change', fileListener);
  
  // Dosya seçme dialogunu aç
  fileInput.click();
}

// Kayıtlı ayarlarla görsel oluşturma
function createImageWithSettings(imageUrl, settings, callback) {
  // Önce wrapper oluştur
  const wrapper = document.createElement('div');
  wrapper.className = 'draggable-img-wrapper';
  
  // İmgElement oluştur
  const imgElement = document.createElement('img');
  imgElement.src = imageUrl;
  imgElement.className = 'draggable-img';
  
  // onload fonksiyonu - görüntü yüklendikten sonra ayarları uygular
  imgElement.onload = function() {
    // Marker oluşturup haritaya ekle
    const icon = L.divIcon({
      html: wrapper,
      iconSize: [0, 0],
      className: ''
    });
    
    const imgMarker = L.marker([settings.lat, settings.lng], {
      icon: icon,
      draggable: true
    }).addTo(map);
    
    // Initial setup
    imgMarker.dragging.disable();// Dört köşe için boyutlandırma tutamaçları oluştur
    const resizeHandleNW = document.createElement('div');
    resizeHandleNW.className = 'resize-handle resize-handle-nw';
    
    const resizeHandleNE = document.createElement('div');
    resizeHandleNE.className = 'resize-handle resize-handle-ne';
    
    const resizeHandleSW = document.createElement('div');
    resizeHandleSW.className = 'resize-handle resize-handle-sw';
    
    const resizeHandleSE = document.createElement('div');
    resizeHandleSE.className = 'resize-handle resize-handle-se';
    
    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'rotation-handle';
    rotateHandle.innerHTML = '<i class="fas fa-sync-alt"></i>';
    
    const rotationGuide = document.createElement('div');
    rotationGuide.className = 'rotation-guide';
    rotationGuide.textContent = '0°';
    
    const closeBtn = document.createElement('div');
    closeBtn.className = 'image-close-btn';
    closeBtn.innerHTML = '&times;';wrapper.appendChild(imgElement);
    wrapper.appendChild(resizeHandleNW);
    wrapper.appendChild(resizeHandleNE);
    wrapper.appendChild(resizeHandleSW);
    wrapper.appendChild(resizeHandleSE);
    wrapper.appendChild(rotateHandle);
    wrapper.appendChild(rotationGuide);
    wrapper.appendChild(closeBtn);
    
    // Önce kayıtlı ayarları uygula
    imgElement.style.width = settings.width + 'px';
    imgElement.style.height = settings.height + 'px';
    imgElement.style.opacity = settings.opacity;
    imgElement.style.transform = `rotate(${settings.rotation}deg)`;// Özellikleri etkinleştir
    enableResize(resizeHandleNW, imgElement, 'nw');
    enableResize(resizeHandleNE, imgElement, 'ne');
    enableResize(resizeHandleSW, imgElement, 'sw');
    enableResize(resizeHandleSE, imgElement, 'se');
    enableRotation(rotateHandle, imgElement, rotationGuide);
    
    // Delete image handler
    closeBtn.addEventListener('click', () => {
      map.removeLayer(imgMarker);
      const index = images.findIndex(img => img.marker === imgMarker);
      if (index !== -1) {
        images.splice(index, 1);
        imageScaleRatios.splice(index, 1);
        
        if (images.length === 0) {
          toggleBtn.disabled = true;
          addMarkersBtn.disabled = true;
          saveSettingsBtn.disabled = true;
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
      filename: settings.filename || imageUrl.substring(imageUrl.lastIndexOf('/') + 1)
    };
    
    images.push(imageObj);
    
    // Her yeni görsel için zoom oranını kaydet
    const aspectRatio = settings.width / settings.height;
    imageScaleRatios.push({
      zoom: map.getZoom(),
      width: settings.width,
      aspectRatio: aspectRatio
    });
    
    activeImageIndex = images.length - 1;
    activateImage(activeImageIndex);
    
    // Callback'i çağır - işlem tamamlandı
    if (callback) callback();
  };
}

// Tüm görselleri temizleme fonksiyonu
function clearAllImages() {
  // Tüm görselleri kaldır
  images.forEach(img => {
    map.removeLayer(img.marker);
  });
  
  // Arrays'i temizle
  images = [];
  imageScaleRatios = [];
  
  // UI'ı güncelle
  activeImageIndex = -1;
  toggleBtn.disabled = true;
  addMarkersBtn.disabled = true;
  saveSettingsBtn.disabled = true;
  opacityRange.disabled = true;
  rotationRange.disabled = true;
  rotationDegree.disabled = true;
  activeImageLabel.textContent = 'No active image';
}rotationRange.addEventListener('input', () => {
  if (activeImageIndex >= 0 && images[activeImageIndex]) {
    const newRotation = parseInt(rotationRange.value);
    rotationDegree.value = newRotation;
    rotateActiveImage(newRotation);
  }
});

rotationRange.addEventListener('change', () => {
  // Değişiklik bittiğinde işlemi kaydet
  if (activeImageIndex >= 0 && images[activeImageIndex] && !isUndoOperation) {
    const oldRotation = getRotationDegrees(images[activeImageIndex].element);
    const newRotation = parseInt(rotationRange.value);
    
    if (oldRotation !== newRotation) {
      recordAction('rotation', activeImageIndex, {
        oldValue: oldRotation,
        newValue: newRotation
      });
      updateUndoButtonState();
    }
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

rotationDegree.addEventListener('change', () => {
  // Değişiklik bittiğinde işlemi kaydet
  if (activeImageIndex >= 0 && images[activeImageIndex] && !isUndoOperation) {
    const oldRotation = getRotationDegrees(images[activeImageIndex].element);
    const newRotation = parseInt(rotationDegree.value);
    
    if (oldRotation !== newRotation) {
      recordAction('rotation', activeImageIndex, {
        oldValue: oldRotation,
        newValue: newRotation
      });
      updateUndoButtonState();
    }
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