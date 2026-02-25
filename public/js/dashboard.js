document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('certificateForm');
  if (!form) return;

  const requiredFields = [...form.querySelectorAll('input[required], select[required]')];

  requiredFields.forEach((input) => {
    input.addEventListener('blur', () => {
      if (!input.value.trim()) {
        input.style.borderColor = '#dc2626';
      } else {
        input.style.borderColor = '#dbe3f0';
      }
    });
  });
});