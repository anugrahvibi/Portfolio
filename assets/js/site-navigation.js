(() => {
  const siteNav = document.querySelector('.site-nav');
  const main = document.querySelector('main');
  if (!siteNav || !main) return;

  const pageLinks = [...siteNav.querySelectorAll('a[href]')];
  const pagePaths = new Set(pageLinks.map((link) => new URL(link.href).pathname));
  let navigationId = 0;

  function setCurrentPage(pathname) {
    pageLinks.forEach((link) => {
      const current = new URL(link.href).pathname === pathname;
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  async function showPage(url, { push = true } = {}) {
    const id = ++navigationId;
    try {
      const response = await fetch(url.href, {
        headers: { Accept: 'text/html' },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Navigation returned ${response.status}`);
      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, 'text/html');
      const nextMain = nextDocument.querySelector('main');
      if (id !== navigationId) return;
      if (!nextMain) throw new Error('The destination page has no main content.');

      main.innerHTML = nextMain.innerHTML;
      document.title = nextDocument.title;
      setCurrentPage(url.pathname);
      if (push) history.pushState({}, '', url.href);
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event('portfolio:navigate'));
    } catch (_) {
      // Keep native navigation as a reliable fallback if a page cannot be fetched.
      window.location.assign(url.href);
    }
  }

  siteNav.addEventListener('click', (event) => {
    const target = event.target;
    const link = target instanceof Element ? target.closest('a[href]') : null;
    if (!link || !pageLinks.includes(link) || event.defaultPrevented ||
        event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.target || link.hasAttribute('download')) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || !pagePaths.has(url.pathname) ||
        url.pathname === window.location.pathname) return;

    event.preventDefault();
    void showPage(url);
  });

  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    if (pagePaths.has(url.pathname)) void showPage(url, { push: false });
  });
})();
