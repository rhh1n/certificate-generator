document.addEventListener('DOMContentLoaded', () => {
  const landing = document.getElementById('liveLanding');
  const tiltCard = document.getElementById('tiltCard');
  if (!landing) return;

  // Ambient floating particles for subtle live motion.
  for (let i = 0; i < 18; i += 1) {
    const node = document.createElement('span');
    node.className = 'floating-node';
    node.style.left = `${8 + Math.random() * 84}%`;
    node.style.top = `${14 + Math.random() * 72}%`;
    node.style.animationDelay = `${Math.random() * 10}s`;
    node.style.animationDuration = `${10 + Math.random() * 9}s`;
    node.style.transform = `scale(${0.7 + Math.random() * 0.7})`;
    landing.appendChild(node);
  }

  if (!tiltCard) return;

  landing.addEventListener('mousemove', (event) => {
    const rect = tiltCard.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nx = (x / rect.width - 0.5) * 2;
    const ny = (y / rect.height - 0.5) * 2;

    const rx = -(ny * 5);
    const ry = nx * 5;

    tiltCard.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
    tiltCard.style.boxShadow = '0 22px 46px rgba(15, 23, 42, 0.13)';
  });

  landing.addEventListener('mouseleave', () => {
    tiltCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    tiltCard.style.boxShadow = '0 18px 42px rgba(15, 23, 42, 0.08)';
  });
});