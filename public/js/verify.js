document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('qrImageInput');
  const status = document.getElementById('qrDecodeStatus');
  const historyList = document.getElementById('searchHistory');
  const certInput = document.getElementById('certificateIdInput');
  const searchedId = certInput ? certInput.value.trim() : '';

  function loadHistory() {
    const items = JSON.parse(localStorage.getItem('certSearchHistory') || '[]');
    historyList.innerHTML = '';

    if (!items.length) {
      const li = document.createElement('li');
      li.textContent = 'No recent searches.';
      historyList.appendChild(li);
      return;
    }

    items.slice(0, 8).forEach((id) => {
      const li = document.createElement('li');
      li.innerHTML = `<a class="text-link" href="/verify/${id}">${id}</a>`;
      historyList.appendChild(li);
    });
  }

  function saveHistory(id) {
    if (!id) return;
    const current = JSON.parse(localStorage.getItem('certSearchHistory') || '[]');
    const updated = [id, ...current.filter((item) => item !== id)].slice(0, 10);
    localStorage.setItem('certSearchHistory', JSON.stringify(updated));
    loadHistory();
  }

  if (searchedId) {
    saveHistory(searchedId);
  } else {
    loadHistory();
  }

  if (!input || !status) return;

  input.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    status.textContent = 'Reading image...';
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, canvas.width, canvas.height);

        if (!result || !result.data) {
          status.textContent = 'Could not decode QR. Try a clearer image.';
          return;
        }

        status.textContent = 'QR decoded. Redirecting...';
        try {
          const decoded = new URL(result.data);
          window.location.href = decoded.pathname;
        } catch (error) {
          if (result.data.startsWith('/verify/')) {
            window.location.href = result.data;
          } else {
            status.textContent = 'QR is not a valid verification URL.';
          }
        }
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
});