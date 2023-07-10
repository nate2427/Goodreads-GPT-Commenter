// opens a url to a book
function openBookPage(url) {
  chrome.tabs.create({ url: url });
}

// extracts comments from book page
function extractComments(tabId) {
  chrome.tabs.sendMessage(
    tabId,
    { action: "extractComments" },
    function (comments) {
      // Step 3: Switch to ChatGPT tab and load comments
      switchToChatGPTTab(tabId, comments[0]);
    }
  );
}

// extracts comments from goodreads
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "extractComments") {
    // console.log("printing");
    // let reviewCards = document.querySelectorAll(".ReviewCard");
    // reviewCards.forEach((card) => {
    //   console.log(card);
    // });
    // const comments = Array.from(document.querySelectorAll(".commentSelector")) // replace '.commentSelector' with the actual selector
    //   .map((comment) => comment.innerText);
    // sendResponse(comments);
  }
});

// loops through comments and submits them one by one to ChatGPT then submits them to Goodreads before moving to the next
function handleComments(comments) {}

// changes the tab to the ChatGPT tab that is configured for commenting on Goodreads
function switchToChatGPTTab(goodreadsTabId, comment) {
  chrome.tabs.query({ url: "*://chat.openai.com/*" }, (tabs) => {
    if (tabs.length) {
      chrome.tabs.update(tabs[0].id, { active: true }, function (tab) {
        // Step 4: Load comment into ChatGPT
        loadCommentIntoChatGPT(tab.id, comment);

        // Step 5: Submit comment to ChatGPT
        submitCommentToChatGPT(tab.id);

        // Step 6: Extract response
        setTimeout(function () {
          extractResponse(tab.id, goodreadsTabId);
        }, 5000); // Wait for 5 seconds to give ChatGPT time to generate a response
      });
    } else {
      console.log("No ChatGPT tab found");
    }
  });
}

// loads a specific comment into ChatGPT
function loadCommentIntoChatGPT(tabId, comment) {
  const loadCommentScript = function (comment) {
    document.querySelector(".inputSelector").value = comment; // replace '.inputSelector' with the actual selector
  };

  chrome.tabs.executeScript(tabId, {
    code: `(${loadCommentScript.toString()})(${JSON.stringify(comment)})`,
  });
}

// submitting a comment to ChatGPT
function submitCommentToChatGPT(tabId) {
  const submitCommentScript = function () {
    document.querySelector(".submitSelector").click(); // replace '.submitSelector' with the actual selector
  };

  chrome.tabs.executeScript(tabId, {
    code: `(${submitCommentScript.toString()})()`,
  });
}

// extracts ChatGPT's response
function extractResponse(chatGPTTabId, goodreadsTabId) {
  const extractResponseScript = function () {
    return document.querySelector(".responseSelector").innerText; // replace '.responseSelector' with the actual selector
  };

  chrome.tabs.executeScript(
    chatGPTTabId,
    {
      code: `(${extractResponseScript.toString()})()`,
    },
    function (response) {
      // Step 7: Switch back to Goodreads tab and post response
      switchBackToGoodreadsTab(goodreadsTabId, response[0]);
    }
  );
}

function handleResponse(response) {
  // Do something with the response
}

// switch back to Goodreads tab
function switchBackToGoodreadsTab(tabId, response) {
  chrome.tabs.update(tabId, { active: true }, function (tab) {
    // Step 8: Post response on Goodreads
    postResponseOnGoodreads(tab.id, response);
  });
}

// comment on book
function postResponseOnGoodreads(tabId, response) {
  const postResponseScript = function (response) {
    document.querySelector(".commentInputSelector").value = response; // replace '.commentInputSelector' with the actual selector
    document.querySelector(".postButtonSelector").click(); // replace '.postButtonSelector' with the actual selector
  };

  chrome.tabs.executeScript(tabId, {
    code: `(${postResponseScript.toString()})(${JSON.stringify(response)})`,
  });
}

// runs the automation for a specific book url
async function mainFunction(bookUrl) {
  console.log(`Running bot for book: ${bookUrl}`);

  // Get the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0]; // There should only be one in this list
    var tabId = tab.id; // Get the id of the current active tab

    // Change the URL of the current tab
    chrome.tabs.update(tabId, { url: bookUrl });

    // Add the listener
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (info.status === "complete" && tabId === tab.id) {
        // Remove the listener now that the tab has finished loading
        chrome.tabs.onUpdated.removeListener(listener);

        // Input the data
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: async () => {
            // Extracts the review details from the html and returns it as an object
            async function extractReviewDetails(article) {
              const name = article.querySelector(
                ".ReviewerProfile__name a"
              ).textContent;
              const profileUrl = article.querySelector(
                ".ReviewerProfile__name a"
              ).href;
              const avatarUrl = article.querySelector(".Avatar__image").src;
              const reviewDate = article.querySelector(
                ".ReviewCard__row .Text a"
              ).textContent;
              const reviewText = article.querySelector(
                ".ReviewText__content .Formatted"
              ).textContent;
              const ratingStars =
                article.querySelectorAll(".RatingStar__fill").length;

              // Return the details
              return {
                name,
                profileUrl,
                avatarUrl,
                reviewDate,
                reviewText,
                ratingStars,
              };
            }

            async function extractDetailsFromArticles() {
              // Return a new Promise
              return new Promise((resolve, reject) => {
                // Get all the articles
                let articles = document.querySelectorAll("article.ReviewCard");
                let reviews = null;
                let intervalId = setInterval(() => {
                  if (articles.length > 0) {
                    // Reviews found, clear the interval
                    clearInterval(intervalId);
                    // Process the reviews...
                    const reviews = Array.from(articles).map((article) =>
                      // Extract the details from each article
                      extractReviewDetails(article)
                    );
                    // console.log(reviews);
                    resolve(reviews);
                  } else {
                    articles = document.querySelectorAll("article.ReviewCard");
                  }
                }, 500);
              });
            }
            // Function to grab the comments
            async function grabReviews() {
              // get the reviews
              let reviewPromises = await extractDetailsFromArticles();
              let reviews = await Promise.all(
                reviewPromises.map((reviewPromise) => reviewPromise)
              );
              return reviews;
            }
            const reviews = await grabReviews();
            // handle the reviews
            // console.log(reviews); // Send the reviews to the background script
            // debugger;
            chrome.runtime.sendMessage({ action: "reviews", data: reviews });
          },
        });
      }
    });
  });
}

// listen for when the runBot event is given
chrome.runtime.onMessage.addListener(async function (
  request,
  sender,
  sendResponse
) {
  // handle the runBot button
  if (request.action === "runBot") {
    for (const bookUrl of request.bookLinks) {
      // Run the main function for each book link
      await mainFunction(bookUrl);
    }
  }
  // Handle the reviews here
  else if (request.action === "reviews") {
    console.log(request.data);
    // load ChatGPT in the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0]; // There should only be one in this list
      var tabId = tab.id; // Get the id of the current active tab

      // Change the URL of the current tab to ChatGPT
      chrome.tabs.update(
        tabId,
        {
          url: "https://chat.openai.com/c/7fa9c8e7-59f9-4b47-85b7-bfc0bbcfd90e",
        },
        function () {
          // Wait for the tab to finish loading
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (info.status === "complete") {
              // Remove this listener
              chrome.tabs.onUpdated.removeListener(listener);

              // Now the new page has loaded, execute your code
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                function: talkToChatGPTAndComment,
                args: [request.data],
              });
            }
          });
        }
      );
    });
  }
});

// This is the function you want to inject into the page
function talkToChatGPTAndComment(reviews) {
  // Function to check for the textarea and add the text
  function addTextToTextarea() {
    // Find the textarea by its id
    const textarea = document.getElementById("prompt-textarea");

    // If the textarea exists
    if (textarea) {
      // Find the button. It's the next sibling of the textarea.
      const button = textarea.nextElementSibling;

      setTimeout(() => {
        // focus the cursor inside the textarea
        textarea.focus();
        // Set the value of the textarea
        textarea.value = reviews[0].reviewText;
        // Set the cursor at the end of the text
        // Create a new 'input' event
        var event = new Event("input", {
          bubbles: true,
          cancelable: true,
        });

        // Dispatch the event
        textarea.dispatchEvent(event);
        // If the button is disabled, enable it
        if (button.disabled) {
          button.disabled = false;
        }

        // Click the button
        // button.click();

        // get the data from ChatGPT
        setTimeout(() => {
          const messageList = document
            .querySelector(
              "#__next > div.overflow-hidden.w-full.h-full.relative.flex.z-0 > div.relative.flex.h-full.max-w-full.flex-1.overflow-hidden > div > main > div.flex-1.overflow-hidden > div > div > div"
            )
            .querySelectorAll(".group");

          // Get the last item from the message list
          const lastMessage = messageList[messageList.length - 1];

          // Get the content of the last message
          const messageContent =
            lastMessage.querySelector("div.markdown > p").textContent;
        }, 2000);
      }, 5000);

      // Clear the interval
      clearInterval(checkTextareaInterval);
    }
  }

  // Check for the textarea every 500 milliseconds
  var checkTextareaInterval = setInterval(addTextToTextarea, 500);
}

//*[@id="__next"]/div[1]/div[2]/div/main/div[2]/div/div/div

//*[@id="__next"]/div[1]/div[2]/div/main/div[2]/div/div/div

//*[@id="__next"]/div[1]/div[2]/div/main/div[2]/div/div/div
