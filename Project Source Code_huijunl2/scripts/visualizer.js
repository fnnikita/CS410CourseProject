const width = 250;
const mergedWidth = 750;
const height = 250;
const margin = {top: 20, right: 20, bottom: 50, left: 30};

/**
 * Get the first day of week for a given date string.
 * 
 * @param {string} d    Date string in the format of YYYY-MM-DD 
 * @returns             Start of the week in the format of YYYY-MM-DD
 */
function getFirstDayOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay(); // 👉️ get day of week
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff)).toISOString().split('T')[0];
}

/**
 * Group data points by x-axis.
 * 
 * @param {{x: string, y: number}} data     data points to be plotted in a graph.
 * @returns                                 data points group by x-axis.
 */
function aggregate(data) {
    const map = {};
    for (const {x, y} of data) {
        if (!(x in map)) {
            map[x] = [];
        }
        map[x].push(y);
    }
    const newData = [];
    for (const [x, yList] of Object.entries(map)) {
        let total = 0;
        let count = 0;
        for (const y of yList) {
            total += y;
            count++;
        }
        newData.push({x, y: total / count});
    }
    return newData;
}

/**
 * Aggregate data points if the duration is more than 90 days.
 * Turn x from date strings to Date objects.
 * Sort the data by date.
 * 
 * @param {Array<object>} rawData   raw data points to be processed.
 * @param {number} durationInDays   the minimum date before today that can be included. 
 * @returns                         processed data points to be plotted.
 */
function processData(rawData, durationInDays) {
    if (durationInDays > 90) {
        rawData = rawData.map(({x, y}) => ({x: getFirstDayOfWeek(x), y})); 
    }
    const aggregatedRawData = aggregate(rawData);
    const data = aggregatedRawData.map(({x, y}) => ({x: new Date(x), y}));
    data.sort((a, b) => (a.x - b.x));
    return data;
}

/**
 * The chart for "Pros" reviews.
 * @param {Array<string>} reviews   review objects.
 * @param {number} durationInDays   the minimum date before today that can be included.
 * @param {Date} minDate            the Date object for the minimum date.
 * @returns                         the SVG DOM object containing the chart.
 */
function buildProScoreChart(reviews, durationInDays, minDate) {
    const data = reviews.map(({date, proScore}) => ({x: date, y: proScore}));
    return buildSplitChart(data, durationInDays, minDate, {color: 'green', title: 'Pro Score'});
}

/**
 * The chart for "Cons" reviews.
 * @param {Array<string>} reviews   review objects.
 * @param {number} durationInDays   the minimum date before today that can be included.
 * @param {Date} minDate            the Date object for the minimum date.
 * @returns                         the SVG DOM object containing the chart.
 */
function buildConScoreChart(reviews, durationInDays, minDate) {
    const data = reviews.map(({date, conScore}) => ({x: date, y: conScore}));
    return buildSplitChart(data, durationInDays, minDate, {color: 'red', title: 'Con Score'});
}

/**
 * The chart for the combination of "Pros" and "Cons" reviews.
 * @param {Array<string>} reviews   review objects.
 * @param {number} durationInDays   the minimum date before today that can be included.
 * @param {Date} minDate            the Date object for the minimum date.
 * @returns                         the SVG DOM object containing the chart.
 */
function buildAvgScoreChart(reviews, durationInDays, minDate) {
    const data = reviews.map(({date, avgScore}) => ({x: date, y: avgScore}));
    return buildSplitChart(data, durationInDays, minDate, {color: 'blue', title: 'Avg Score'});
}


/**
 * The chart for all of the "Pros", "Cons" and the combination reviews.
 * @param {Array<string>} reviews   review objects.
 * @param {number} durationInDays   the minimum date before today that can be included.
 * @param {Date} minDate            the Date object for the minimum date.
 * @returns                         the SVG DOM object containing the chart.
 */
function buildMergedChart(reviews, durationInDays, minDate) {
    const proData = processData(reviews.map(({date, proScore}) => ({x: date, y: proScore})), durationInDays);
    const conData = processData(reviews.map(({date, conScore}) => ({x: date, y: conScore})), durationInDays);
    const avgData = processData(reviews.map(({date, avgScore}) => ({x: date, y: avgScore})), durationInDays);

    const axis = {};
    const svg = d3.select("#charts").append("svg").attr("width", mergedWidth).attr("height", height);
    setupChart(svg, axis, minDate, 'Merged Chart', true);

    drawDots(svg, axis, proData, 'green');
    drawCurve(svg, axis, proData, 'green');
    
    drawDots(svg, axis, conData, 'red');
    drawCurve(svg, axis, conData, 'red');
    
    drawDots(svg, axis, avgData, 'blue');
    drawCurve(svg, axis, avgData, 'blue');

    return svg;
}

/**
 * Create the chart inside the SVG DOM object with d3.js and set the x & y function in the axis object.
 * 
 * @param {object} svg              an empty SVG DOM object.
 * @param {object} axis             an empty object that will be added the x & y functions.
 * @param {Date} minDate            the minimum Date object.
 * @param {string} title            the title of the chart.  
 * @param {boolean} isMergedChart   whether the chart includes all "Pros", "Cons" and average review scores.
 */
function setupChart(svg, axis, minDate, title, isMergedChart) {
    const chartWidth = isMergedChart ? mergedWidth : width;
    // Add title.
    svg.append("text")
        .attr("x", ((margin.left + chartWidth + margin.right) / 2))             
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(title);

    // Add x-axis.
    const x = d3.scaleTime()
        .domain([minDate, new Date()])
        .range([margin.left, chartWidth - margin.right]);
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll("text")	
          .style("text-anchor", "end")
          .attr("dx", "-.8em")
          .attr("dy", ".15em")
          .attr("transform", "rotate(-60)");

    // Add y-axis.
    const y = d3.scaleLinear()
        .domain([0, 5])
        .range([height - margin.bottom, margin.top]);
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));
        
    axis.x = x;
    axis.y = y;
}

function drawDots(svg, axis, data, color) {
    const {x, y} = axis;
    svg.append("g")
        .selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("r", 2.5)
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .style("fill", color)
        .style("opacity", 0.3);
}

function drawCurve(svg, axis, data, color) {
    const {x, y} = axis;
    const curve = d3.line()
        .x((d) => x(d.x))
        .y((d) => y(d.y))
        .curve(d3.curveBasisOpen);
    svg.append("path")
        .attr("d", curve(data))
        .attr("fill", "none")
        .attr("stroke", color);
}

function buildSplitChart(rawData, durationInDays, minDate, config) {
    const {color, title} = config;

    const data = processData(rawData, durationInDays);

    const axis = {};
    const svg = d3.select("#charts").append("svg").attr("width", width).attr("height", height);

    setupChart(svg, axis, minDate, title);
    drawDots(svg, axis, data, color);
    drawCurve(svg, axis, data, color);
    return svg;
}

// Listen to messages sent by script living outside of the sandbox.
window.addEventListener('message', function (event) {
    const {name, durationInDays, shouldMergeCharts, minDate, reviews} = event.data;

    if (name === 'visualizeReviews') {
        const charts = document.querySelector('#charts');        
        charts.innerHTML = '';

        if (shouldMergeCharts) {
            buildMergedChart(reviews, durationInDays, minDate);
        } else {
            buildProScoreChart(reviews, durationInDays, minDate);
            buildConScoreChart(reviews, durationInDays, minDate);
            buildAvgScoreChart(reviews, durationInDays, minDate);
        }
        
        const serializedCharts = (new XMLSerializer()).serializeToString(charts);
        window.parent.postMessage({name: 'visualizeReviewsUpdated', serializedCharts}, '*');
    }
});