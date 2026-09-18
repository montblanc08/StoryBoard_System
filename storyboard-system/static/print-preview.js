/* Runs in the generated same-origin preview without unsafe-inline scripts. */
(() => {
  const button = document.getElementById('printBtn');
  if (!button) return;
  button.addEventListener('click', () => window.print());
  const images = [...document.querySelectorAll('img')];
  let done = 0, failures = 0;
  const finish = () => {
    button.textContent = done < images.length ? `准备图片 ${done} / ${images.length}`
      : `打印 / 另存为 PDF${failures ? `（${failures} 张图片未加载）` : ''}`;
    button.disabled = done < images.length;
  };
  images.forEach(img => {
    let settled = false;
    const settle = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done++;
      if (!ok) { failures++; img.alt = `图片未加载 · SHOT ${img.dataset.shot || ''}`; }
      finish();
    };
    const timer = setTimeout(() => settle(false), 15000);
    img.addEventListener('load', () => settle(true), { once: true });
    img.addEventListener('error', () => settle(false), { once: true });
    if (img.complete) settle(img.naturalWidth > 0);
  });
  finish();
})();
