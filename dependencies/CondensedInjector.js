let url = "https://bonk.io/js/alpha2s.js";
window.code = new Promise(async res => res(await (await fetch(url + "?")).text()));
window._appendChild = document.head.appendChild;
document.head.appendChild = function(...args) {
  if(args[0].src === url) {
    args[0].removeAttribute("src");
    (async () => {
      window.code = await window.code;
      while(!window.bonkCodeInjectors) await new Promise(res => setTimeout(res, 100));
      for(injector of window.bonkCodeInjectors) window.code = injector(window.code);
      args[0].textContent = window.code;
      args[0].dispatchEvent(new Event("load"));
      return window._appendChild.apply(document.head, args);
    })();
  } else {
    return window._appendChild.apply(document.head, args);
  }
}
