const EXTENSION_CONFIG = {
    concurrency: 2,
    maximumFetchPages: 1000,
    delayPerCall: 1500, // Adding delay to prevent 429 error code.
};

const TAG_LI = 'li';
const TAG_BUTTON = 'button';

// Controls whether to fetch next pages.
let shouldStopFetching = false;
// Keep track of the next page to be fetched.
let nextPage = 1;
// Keep track of the current fetching pages.
const fetchingPageSet = new Set();
// Keep track of the current analyzing pages.
const analyzingPageSet = new Set();
const allReviews = [];
let durationInDays = 0;
let minDate = '';
let shouldMergeCharts = true;

function getMinDate() {
    const date = new Date();
    const diff = date.getDate() - durationInDays;
    return new Date(date.setDate(diff));
}

function getNextPage() {
    return nextPage++;
}

function createTag(tag, content) {
    const element = document.createElement(tag);
    element.textContent = content;
    return element;
}

function updateContent(selector, content) {
    const element = document.querySelector(selector);
    element.textContent = content;
}

function updateFetchingMessage() {
    updateContent('#fetching-pages', fetchingPageSet.size > 0 ? [...fetchingPageSet].join(',') : '-');
}

function updateAnalyzingMessage() {
    updateContent('#analyzing-pages', analyzingPageSet.size > 0 ? [...analyzingPageSet].join(',') : '-');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showTag(selector) {
    const tag = document.querySelector(selector);
    tag.style.display = "flex";
}

function hideTag(selector) {
    const tag = document.querySelector(selector);
    tag.style.display = "none";
}

async function process(pageNumber) {
    if (shouldStopFetching) {
        hideTag('#fetching-pages-container');
        hideTag('#analyzing-pages-container');
        return;
    }
    fetchingPageSet.add(pageNumber);
    updateFetchingMessage();
    await sleep(EXTENSION_CONFIG.delayPerCall);
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0].url.includes('://www.glassdoor.com')) {
            alert('Visit www.glassdoor.com to enable this extension.');
            return;
        }
        // Crawl reviews.
        chrome.tabs.sendMessage(tabs[0].id, {
            name: 'crawlReviews',
            pageNumber,
            minDate: minDate.toISOString().split('T')[0],
        }, function (response) {
            fetchingPageSet.delete(pageNumber);
            updateFetchingMessage();

            const status = response?.status ?? -1;
            if (status !== 200) {
                const errorList = document.querySelector('#error-list');
                const li = createTag(TAG_LI, `errorCode for page${pageNumber}: ${response.status}`);
                const button = createTag(TAG_BUTTON, 'retry');
                button.addEventListener('click', () => {
                    crawlReviews(pageNumber);
                    errorList.removeChild(li);
                });
                li.appendChild(button);
                errorList.appendChild(li);
                return;
            }

            const {reviews} = response;
            if (!reviews || reviews.length === 0) {
                // No more page.
                shouldStopFetching = true;
                return;
            }

            analyzingPageSet.add(pageNumber);
            updateAnalyzingMessage();
            const sandboxIframe = document.getElementById('sandbox-iframe');
            sandboxIframe.contentWindow.postMessage({
                name: 'analyzeReviews',
                pageNumber,
                reviews,
            }, /*targetOrigin=*/'*');
            process(getNextPage());
        });
    });
}

// Listen to messages sent by script living inside the sandbox.
window.addEventListener('message', function (event) {
    const {name, pageNumber, reviews, serializedCharts} = event.data;
    if (name === 'modelLoaded') {
        onModelLoaded();
    }
    else if (name === 'analyzeReviewsFinished') {
        analyzingPageSet.delete(pageNumber);
        updateAnalyzingMessage();

        const reviewList = document.querySelector('#review-list');
        for (const review of reviews) {
            allReviews.push(review);
            const li = createTag(TAG_LI, JSON.stringify(review));
            reviewList.appendChild(li);
        }
        
        const sandboxIframe = document.getElementById('sandbox-iframe');
        sandboxIframe.contentWindow.postMessage({
            name: 'visualizeReviews',
            durationInDays,
            minDate,
            shouldMergeCharts,
            reviews: allReviews,
        }, /*targetOrigin=*/'*');
    } else if (name === 'visualizeReviewsUpdated') {
        const chartsContainer = document.querySelector('#charts-container');
        const charts = (new DOMParser).parseFromString(serializedCharts, "application/xml");
        chartsContainer.innerHTML = '';
        chartsContainer.append(...charts.children);
    }
});

function updateDuration() {
    const duration = document.querySelector('#duration');
    durationInDays = parseInt(duration.value);
    minDate = getMinDate();

    const selectedDuration = document.querySelector('#selected-duration');
    selectedDuration.textContent = duration.value;
}

function onModelLoaded() {
    const msgElement = document.querySelector('#message');
    msgElement.textContent = '';

    const startButton = document.querySelector('#start-fetching');
    startButton.addEventListener('click', () => {
        shouldStopFetching = false;
        hideTag('#start-panel');
        showTag('#stop-panel');
        //  Process concurrently.
        for (let i = 0; i < EXTENSION_CONFIG.concurrency; ++i) {
            process(getNextPage());
        }
    });

    const duration = document.querySelector('#duration');
    duration.addEventListener("change", updateDuration);
    updateDuration();

    // Setup stop button.
    const stopButton = document.querySelector('#stop-fetching');
    stopButton.addEventListener('click', () => {
        shouldStopFetching = true;
        hideTag('#stop-panel');
    });

    const mergeChartsButton = document.querySelector('#merge-charts');
    mergeChartsButton.addEventListener('click', () => {
        const mergeChartsSlider = document.querySelector('#merge-charts-slider');
        shouldMergeCharts = mergeChartsSlider.value == "1";

        const sandboxIframe = document.getElementById('sandbox-iframe');
        sandboxIframe.contentWindow.postMessage({
            name: 'visualizeReviews',
            durationInDays,
            minDate,
            shouldMergeCharts,
            reviews: allReviews,
        }, /*targetOrigin=*/'*');
    })

    // Show start panel.
    showTag('#panel');
    showTag('#start-panel');
    hideTag('#stop-panel');
}

