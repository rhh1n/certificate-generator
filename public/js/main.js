document.addEventListener('DOMContentLoaded', () => {
  const loadingButtons = document.querySelectorAll('.loading-btn');

  loadingButtons.forEach((button) => {
    const form = button.closest('form');
    if (!form) return;

    form.addEventListener('submit', () => {
      button.dataset.originalText = button.textContent;
      button.textContent = button.dataset.loadingText || 'Please wait...';
      button.disabled = true;
    });
  });

  const toast = document.querySelector('.toast');
  if (toast) {
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 300ms ease';
      setTimeout(() => toast.remove(), 320);
    }, 3000);
  }
});