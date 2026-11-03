// Builds the contents box from the section titles and adds the "back to contents" button.
(function () {
  const contents = document.getElementById("toc");
  if (!contents) {
    return;
  }

  const titles = Array.from(document.querySelectorAll("main h2[id]"));
  const links = titles.map(
    (title, i) => `<a href="#${title.id}"><b>${i + 1}</b>${title.textContent}</a>`,
  );
  contents.innerHTML = `<span class="toc-title">Contents</span>${links.join("")}`;

  const backButton = document.createElement("a");
  backButton.className = "totop";
  backButton.href = "#toc";
  backButton.textContent = "↑ Contents";
  document.body.appendChild(backButton);

  const updateButton = () => backButton.classList.toggle("show", window.scrollY > 500);
  window.addEventListener("scroll", updateButton, { passive: true });
  updateButton();
})();
