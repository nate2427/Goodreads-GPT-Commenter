// extracts comments from goodreads
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "extractComments") {
    console.log("printing");
    let reviewCards = document.querySelectorAll(".ReviewCard");
    reviewCards.forEach((card) => {
      console.log(card);
    });

    const comments = Array.from(document.querySelectorAll(".commentSelector")) // replace '.commentSelector' with the actual selector
      .map((comment) => comment.innerText);
    sendResponse(comments);
  }
});
