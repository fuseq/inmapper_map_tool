
let dragMode = "map";
let imgMarker = null;
let imgElement = null;
let resizeHandle = null;
let cornerMarkers = [];

let initialZoom = null;
let originalImgWidth = null;

const map = L.map('map').setView([39.92, 32.85], 13);
const toggleBtn = document.getElementById('toggleModeBtn');
const imageInput = document.getElementById('file-upload');
const addMarkersBtn = document.getElementById('addMarkersBtn');

const coordinatesDiv = document.createElement('div');
coordinatesDiv.style.position = 'fixed';
coordinatesDiv.style.bottom = '10px';
coordinatesDiv.style.left = '10px';
coordinatesDiv.style.fontSize = '14px';
coordinatesDiv.style.fontWeight = 'bold';
coordinatesDiv.style.color = '#000';
coordinatesDiv.style.zIndex = '1000';
coordinatesDiv.style.paddingTop = '10px';
document.body.appendChild(coordinatesDiv);

document.body.style.overflowY = 'hidden';

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

map.dragging.enable();

let selectedImageURL = null;

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedImageURL = URL.createObjectURL(file);
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

  const latlng = imgMarker.getLatLng();
  const topLeft = map.latLngToContainerPoint(latlng);
  const bottomRight = topLeft.add([imgWidth, imgHeight]);

  const corners = [
    map.containerPointToLatLng(topLeft),
    map.containerPointToLatLng(bottomRight)
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

    return `[${corner.lat.toFixed(7)}, ${corner.lng.toFixed(7)}]`;
  });

  coordinatesDiv.textContent = formattedCorners.join(', ');
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