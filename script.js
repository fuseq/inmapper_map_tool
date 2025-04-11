let dragMode = "map";
let imgMarker = null;
let selectedImageURL = null;
let imgElement = null;
let resizeHandle = null;
let cornerMarkers = [];

let initialZoom = null;
let originalImgWidth = null;

const map = L.map('map').setView([39.92, 32.85], 6); 
const toggleBtn = document.getElementById('toggleModeBtn');
const imageInput = document.getElementById('file-upload');
const addMarkersBtn = document.getElementById('addMarkersBtn');

document.body.style.overflowY = 'hidden';

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
}).addTo(map);

map.dragging.enable();

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedImageURL = URL.createObjectURL(file);
    opacityRange.disabled = false;  // Resim seçildiyse opacity scroll'ü aktif et
    opacityRange.value = 1;  // Opacity scroll'unu tam yap (1)
  } else {
    selectedImageURL = null;
    opacityRange.disabled = true;  // Resim yoksa opacity scroll'ü devre dışı bırak
  }

  // Yeni resim seçildiğinde önceki resmi sil
  if (imgMarker) {
    map.removeLayer(imgMarker);  // Önceki resmi haritadan kaldır
    imgMarker = null;  // imgMarker'ı sıfırla
    toggleBtn.disabled = true;
    addMarkersBtn.disabled = true;
  }
});

map.on('click', (e) => {
  if (!selectedImageURL || imgMarker) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'draggable-img-wrapper';

  imgElement = document.createElement('img');
  imgElement.src = selectedImageURL;
  imgElement.className = 'draggable-img';

  resizeHandle = document.createElement('div');
  resizeHandle.className = 'resize-handle';

  wrapper.appendChild(imgElement);
  wrapper.appendChild(resizeHandle);

  const icon = L.divIcon({
    html: wrapper,
    iconSize: [0, 0],
    className: ''
  });

  imgMarker = L.marker(e.latlng, {
    icon: icon,
    draggable: true
  }).addTo(map);

  imgMarker.dragging.disable();
  toggleBtn.disabled = false;
  addMarkersBtn.disabled = false;

  enableResize(resizeHandle, imgElement);

  originalImgWidth = imgElement.offsetWidth;
  initialZoom = map.getZoom();

  dragMode = "object";
  map.dragging.disable();
  imgMarker.dragging.enable();
  toggleBtn.innerText = "Mod: Image";

  imgElement.addEventListener('dragstart', () => {
    cornerMarkers.forEach(marker => marker.remove());
    cornerMarkers = [];
  });
});

const opacityRange = document.getElementById('opacityRange');
opacityRange.disabled = true;

opacityRange.addEventListener('input', () => {
  if (imgElement) {
    imgElement.style.opacity = opacityRange.value;
  }
});

toggleBtn.addEventListener('click', () => {
  if (!imgMarker) return;

  if (dragMode === "map") {
    dragMode = "object";
    map.dragging.disable();
    imgMarker.dragging.enable();
  } else {
    dragMode = "map";
    map.dragging.enable();
    imgMarker.dragging.disable();
  }

  toggleBtn.innerText = "Mod: " + (dragMode === "map" ? "Map" : "Image");
});

function enableResize(handle, img) {
  let isResizing = false;
  let startX, startWidth;
  const aspectRatio = img.width / img.height;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    cornerMarkers.forEach(marker => marker.remove());
    cornerMarkers = [];
    isResizing = true;

    startX = e.clientX;
    startWidth = img.width;

    if (imgMarker) imgMarker.dragging.disable();

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  });

  function resize(e) {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    const newWidth = startWidth + dx;
    if (newWidth > 20) {
      img.style.width = newWidth + 'px';
      img.style.height = (newWidth / aspectRatio) + 'px';
    }
  }

  function stopResize() {
    isResizing = false;
    if (imgMarker && dragMode === 'object') {
      imgMarker.dragging.enable();
    }
    originalImgWidth = img.offsetWidth;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  }
}

addMarkersBtn.addEventListener('click', () => {
  if (!imgMarker) return;

  const imgElement = imgMarker._icon.querySelector('.draggable-img');
  const imgWidth = imgElement.offsetWidth;
  const imgHeight = imgElement.offsetHeight;

  const topLeft = map.latLngToContainerPoint(imgMarker.getLatLng());
  const topRightCorner = topLeft.add([imgWidth, 0]);  // Sağ üst
  const bottomLeftCorner = topLeft.add([0, imgHeight]);  // Sol alt

  const corners = [
    map.containerPointToLatLng(topRightCorner),
    map.containerPointToLatLng(bottomLeftCorner)
  ];

  cornerMarkers.forEach(marker => marker.remove());
  cornerMarkers = [];

  const formattedCorners = corners.map(corner => {
    const marker = L.marker([corner.lat, corner.lng], {
      icon: L.divIcon({
        html: `<div style="width: 12px; height: 12px; background-color: red; border-radius: 50%;"></div>`,
        iconSize: [12, 12]
      })
    }).addTo(map);
    cornerMarkers.push(marker);
    return corner;
  });

  const topRight = formattedCorners[0];
  const bottomLeft = formattedCorners[1];

  // Koordinat kutusunu göster
  const coordinatesDiv = document.getElementById('coordinatesDiv');
  coordinatesDiv.textContent =
    `Sağ Üst: (${topRight.lat.toFixed(6)}, ${topRight.lng.toFixed(6)})\n` +
    `Sol Alt: (${bottomLeft.lat.toFixed(6)}, ${bottomLeft.lng.toFixed(6)})`;

  // Koordinat kutusunu görünür yap
  coordinatesDiv.style.display = 'block';
});

map.on('zoom', () => {
  if (!imgElement || originalImgWidth === null || initialZoom === null) return;

  const currentZoom = map.getZoom();
  const zoomDiff = currentZoom - initialZoom;
  const scaleFactor = Math.pow(2, zoomDiff);

  const newWidth = originalImgWidth * scaleFactor;
  imgElement.style.width = newWidth + 'px';
  imgElement.style.height = 'auto';
});


const searchBox = document.getElementById('ar-search-box');
const searchBtn = document.getElementById('ar-search-btn');

function handleSearch(event) {
  event.preventDefault();
  const query = searchBox.value.trim();
  if (!query) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        map.setView([lat, lon], 16); // Sadece git
      } else {
        alert('Yer bulunamadı.');
      }
    })
    .catch(err => {
      console.error('Arama hatası:', err);
      alert('Bir hata oluştu.');
    });
}