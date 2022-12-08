const QUERY_SELECTOR = {
    RECOMMEND_LEVEL_POSITIVE: 'span.css-hcqxoa',
    RECOMMEND_LEVEL_NEGATIVE: 'span.css-1kiw93k',

    PROS: 'span[data-test="pros"]',
    CONS: 'span[data-test="cons"]',
};

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

function parseReviews(domObject) {
    const reviews = domObject.querySelectorAll('li.empReview');
    const reviewObjects = [...reviews].map((review) => {
        const [div1, div2] = review.querySelectorAll('.gdReview>div');
        const tenureData = div1.textContent.match(/, more than (\d) years/);
        const dateAndPositionSpan = div2.querySelector('span.common__EiReviewDetailsStyle__newUiJobLine>span');
        const date = dateAndPositionSpan.textContent.split(' - ')[0];
        const [position, location] = dateAndPositionSpan.textContent.substring(date.length + 3).split('in');
        const recommend = !!div2.querySelectorAll('.recommends>div')[0].querySelector('span.css-hcqxoa');
        const pros = div2.querySelector('span[data-test="pros"]').textContent;
        const cons = div2.querySelector('span[data-test="cons"]').textContent;
        return {
            ratingNumber: parseInt(review.querySelector('.ratingNumber').textContent),
            isCurrentEmployee: div1.textContent.includes('Current Employee'),
            tenure: tenureData ? parseInt(tenureData[1]) : null,
            date,
            position: position.trim(),
            location: location.trim(),
            recommend,
            pros,
            cons,
        };
    });
    return reviewObjects;
}

async function crawlReviews(pageNumber) {
    const {status, pageDOM} = await fetchPageDOM(pageNumber);
    return {
        status,
        reviews: status === 200 ? parseReviews(pageDOM) : [],
    };
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.action === "crawlReviews" && request.pageNumber > 0) {
        // sendResponse(crawlReviews(request.pageNumber));
        crawlReviews(request.pageNumber).then((response) => {
            sendResponse(response);
        });
      }

      // Return true to indicate response will be send asynchronously.
      return true;
    }
  );