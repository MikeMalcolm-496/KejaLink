const root = document.getElementById('root');
const path = window.location.pathname;
const isVanillaPage = path === '/' || path === '/listings' || path === '/help' || /^\/properties\/\d+\/?$/.test(path);

if (isVanillaPage) {
  import('./vanilla/app').then(({ mount }) => mount(root)).catch((error) => {
    console.error('Unable to load the KejaLink pages.', error);
    root.innerHTML = '<main class="startup-error"><h1>KejaLink could not load</h1><p>Refresh the page to try again.</p></main>';
  });
} else {
  import('./legacy').then(({ mount }) => mount(root)).catch((error) => {
    console.error('Unable to load the KejaLink account application.', error);
    root.innerHTML = '<main class="startup-error"><h1>KejaLink could not load</h1><p>Refresh the page to try again.</p></main>';
  });
}
