(function () {
  var nav = document.getElementById("toc");
  if (!nav) return;
  var hs = Array.prototype.slice.call(document.querySelectorAll("main h2[id]"));
  nav.innerHTML = '<span class="toc-title">Contents</span>' + hs.map(function (h, i) {
    return '<a href="#' + h.id + '"><b>' + (i + 1) + "</b>" + h.textContent + "</a>";
  }).join("");
  var up = document.createElement("a");
  up.className = "totop"; up.href = "#toc"; up.textContent = "↑ Contents";
  document.body.appendChild(up);
  function onScroll() { up.classList.toggle("show", window.scrollY > 500); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
