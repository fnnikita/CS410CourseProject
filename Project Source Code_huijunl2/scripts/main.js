const EXTENSION_CONFIG = {
    concurrency: 2,
    maximumFetchPages: 1000,
    delayPerCall: 1000, // Adding 1,000 ms for preventing 429 error code.
};

// DOM Objects.
const reviewList = document.querySelector('#review-list');
const errorList = document.querySelector('#error-list');
const fetchingPagesDiv = document.querySelector('#fetching-pages');
const stopFetchingButton = document.querySelector('#stop-fetching');
stopFetchingButton.addEventListener('click', () => {
    shouldStopFetching = true;
    stopFetchingButton.remove();
})

// Popup State.
const fetchingPageSet = new Set();
let nextPage = 1;
let shouldStopFetching = false;
  
function getNextPage() {
    return nextPage++;
}

function createLiElement(content) {
    const li = document.createElement('li');
    li.textContent = content;
    return li;
}

function createRetryButton(pageNumber, onClick) {
    const button = document.createElement('button');
    button.textContent = "retry";
    button.addEventListener('click', () => {
        crawlReviews(pageNumber);
        onClick();
    });

    return button;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function crawlReviews(pageNumber) {
    if (shouldStopFetching) {
        return;
    }
    fetchingPageSet.add(pageNumber);
    fetchingPagesDiv.textContent = "Currently Fetching Page: " + [...fetchingPageSet].join(', ');
    await sleep(EXTENSION_CONFIG.delayPerCall);
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0].url.includes('://www.glassdoor.com')) {
            alert('Visit www.glassdoor.com to enable this extension.');
            return;
        }
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'crawlReviews',
            pageNumber: 1,
        }, function ({status, reviews}) {
            fetchingPageSet.delete(pageNumber);
            fetchingPagesDiv.textContent = "Currently Fetching Page: " + [...fetchingPageSet].join(', ');

            if (status !== 200) {
                const li = createLiElement(`errorCode for page${pageNumber}: ${status}`);
                li.appendChild(createRetryButton(pageNumber, () => errorList.removeChild(li)));
                errorList.appendChild(li);
                return;
            }
            
            if (!reviews || reviews.length === 0) {
                // No more page.
                return;
            }
            for (const review of reviews) {
                const li = createLiElement(JSON.stringify(review));
                reviewList.appendChild(li);
            }
            crawlReviews(getNextPage());
        });
    });
}

// Concurrent setup.
for (let i = 0; i < EXTENSION_CONFIG.concurrency; ++i) {
    crawlReviews(getNextPage());
}