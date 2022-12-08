/**
 * Configurations for fetching 
 */
const QUERY_SELECTOR = {
    RECOMMEND_LEVEL_POSITIVE: 'span.css-hcqxoa',
    DATE_AND_POSITION: 'span.common__EiReviewDetailsStyle__newUiJobLine>span',
    PROS: 'span[data-test="pros"]',
    CONS: 'span[data-test="cons"]',
};

/**
 * Fetch a paginated page of the current url.
 * 
 * @param {number} pageNumber   The target page number. 
 * @returns                     The html response status and the serialzied, responded html string of the page.
 */
async function fetchPageDOM(pageNumber) {
    const fetchUrl = (window.location.origin + window.location.pathname).replace(/(_P\d+)?.htm$/, `_P${pageNumber}.htm`);
    return await fetch(fetchUrl)
    .then(async function(response) {
        return {
            status: response.status,
            text: await response.text(),
        };
    })
    .then(async function({status, text}) {
        return {
            status,
            pageDOM: (status === 200) ? new DOMParser().parseFromString(text, 'text/html') : null,
        };
    });
}

/**
 * Parse the review contents inside the html into a list of review objects.
 * 
 * @param {{status, pageDOM}} domObject The DOM of the requested page.
 * @param {Date} minDate                The minimum cutoff date for reviews. 
 * @returns                             A list of review JSON objects.
 */
function parseReviews(domObject, minDate) {
    const reviews = domObject.querySelectorAll('li.empReview');
    const reviewObjects = [...reviews].map((review) => {
        const [div1, div2] = review.querySelectorAll('.gdReview>div');
        const tenureData = div1.textContent.match(/, more than (\d) years/);
        const dateAndPositionSpan = div2.querySelector(QUERY_SELECTOR.DATE_AND_POSITION);
        const date = dateAndPositionSpan.textContent.split(' - ')[0];
        const [position, location] = dateAndPositionSpan.textContent.substring(date.length + 3).split(' in ');
        const recommend = !!div2.querySelectorAll('.recommends>div')[0].querySelector(QUERY_SELECTOR.RECOMMEND_LEVEL_POSITIVE);
        const pros = div2.querySelector(QUERY_SELECTOR.PROS).textContent;
        const cons = div2.querySelector(QUERY_SELECTOR.CONS).textContent;
        return {
            isCurrentEmployee: div1.textContent.includes('Current Employee'),
            tenure: tenureData ? parseInt(tenureData[1]) : null,
            date,
            position: position.trim(),
            location: location ? location.trim() : '',
            recommend,
            pros,
            cons,
        };
    });
    return reviewObjects.filter(review => (new Date(review.date).toISOString().split('T')[0] >= minDate));
}

/**
 * Crawl the reviews from the paginated url.
 * 
 * @param {number} pageNumber   The target page number. 
 * @param {Date} minDate        The minimum cutoff date for reviews. 
 * @returns                     A list of review JSON objects.
 */
async function crawlReviews(pageNumber, minDate) {
    const {status, pageDOM} = await fetchPageDOM(pageNumber);
    return {
        status,
        reviews: status === 200 ? parseReviews(pageDOM, minDate) : [],
    };
}

/**
 * The crawler will listen to the message with the name field "crawlReviews".
 * Upon receiving the message, the will crawl and respond asynchronously to the
 * popup script by using the sendResponse function provided by chrome APIs. 
 */
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.name === "crawlReviews" && request.pageNumber > 0) {
        crawlReviews(request.pageNumber, request.minDate).then((response) => {
            sendResponse(response);
        });
      }

      // Return true to indicate response will be send asynchronously.
      return true;
    }
  );