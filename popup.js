document.getElementById("addButton").addEventListener("click", function () {
  const bookUrl = document.getElementById("bookUrl").value;
  if (bookUrl) {
    const bookList = document.getElementById("bookList");
    const bookLink = document.createElement("div");
    bookLink.className = "bookLink";
    bookLink.innerHTML = `
      <span>${bookUrl}</span>
      <button class="deleteButton">X</button>
    `;
    bookList.appendChild(bookLink);
    document.getElementById("bookUrl").value = "";
    bookLink
      .querySelector(".deleteButton")
      .addEventListener("click", function () {
        bookList.removeChild(bookLink);
      });
  }
});

document.getElementById("runBotButton").addEventListener("click", function () {
  const bookLinks = Array.from(document.querySelectorAll(".bookLink span")).map(
    (span) => span.textContent
  );
  chrome.runtime.sendMessage({ action: "runBot", bookLinks: bookLinks });
});
