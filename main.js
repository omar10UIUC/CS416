let currentSceneIndex = 0;
let superstoreData = [];
let usMapData = null;
let profitByState = new Map();
let profitByCategory = new Map();
let profitByStateAndCategory = new Map();
const scenes = 3; // Total number of scenes

// --- VISUALIZATION DIMENSIONS ---
// Define the dimensions for our SVG container to ensure visual consistency.
const margin = { top: 40, right: 40, bottom: 60, left: 60 };
const width = 960 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// --- D3 SELECTORS ---
// Select the core elements from our HTML.
const container = d3.select("#visualization-container");
const prevButton = d3.select("#prev-button");
const nextButton = d3.select("#next-button");
const sceneIndicator = d3.select("#scene-indicator");

// --- DATA LOADING & INITIALIZATION ---
// Use Promise.all to load both the CSV and GeoJSON files simultaneously.
// IMPORTANT: Due to browser security policies (CORS), this will likely fail
// if you are opening the file with a 'file://' URL. You must use a local
// web server (e.g., 'python -m http.server') to serve these files.
Promise.all([
    d3.csv("superstore.csv")
]).then(function(data) {
    superstoreData = data[0];

    // Clean and pre-process the data for our visualizations.
    superstoreData.forEach(d => {
        d.Profit = +d.Profit;
        d.Discount = +d.Discount;
        d.Sales = +d.Sales;
        d.Quantity = +d.Quantity;
    });

    // Aggregate data for our scenes.
    // Group by state to prepare for the map.
    const profitByStateRaw = d3.rollup(superstoreData, v => d3.sum(v, d => d.Profit), d => d.State);
    profitByState = new Map(profitByStateRaw);

    // Group by category for the bar chart.
    profitByCategory = d3.rollup(superstoreData, v => d3.sum(v, d => d.Profit), d => d.Category);

    // Group by state and category for the detailed bar chart.
    profitByStateAndCategory = d3.rollup(superstoreData, v => d3.sum(v, d => d.Profit), d => d.State, d => d.Category);

    // After loading and processing, start the visualization.
    updateScene(currentSceneIndex);
    setupControls();
}).catch(function(error) {
    console.error("Error loading data:", error);
    container.append("p")
        .style("color", "red")
        .text("Error: Could not load data. Please ensure 'superstore.csv' is in the same directory and you are running a local web server.");
});

// --- SCENE NAVIGATION AND CONTROL FUNCTIONS ---
function setupControls() {
    prevButton.on("click", () => {
        if (currentSceneIndex > 0) {
            currentSceneIndex--;
            updateScene(currentSceneIndex);
        }
    });

    nextButton.on("click", () => {
        if (currentSceneIndex < scenes - 1) {
            currentSceneIndex++;
            updateScene(currentSceneIndex);
        }
    });
}

function updateScene(sceneIndex) {
    // Clear the existing SVG to make way for the new scene.
    container.select("svg").remove();
    container.select(".state-select-container").remove();
    // Remove any lingering tooltip from previous scenes.
    d3.select("body").select(".tooltip").remove();

    // Update the control buttons' state and scene indicator.
    prevButton.property("disabled", currentSceneIndex === 0);
    nextButton.property("disabled", currentSceneIndex === scenes - 1);
    sceneIndicator.text(`Scene ${currentSceneIndex + 1} of ${scenes}`);

    // Call the appropriate scene drawing function.
    if (sceneIndex === 0) {
        drawScene1StateSelectorChart();
    } else if (sceneIndex === 1) {
        drawScene2BarChart();
    } else if (sceneIndex === 2) {
        drawScene3ScatterPlot();
    }
}

// --- SCENE 1: PROFIT BY CATEGORY IN A SELECTED STATE (INTERACTIVE BAR CHART) ---
function drawScene1StateSelectorChart() {
    const states = Array.from(profitByState.keys()).sort();

    // Create a container for the dropdown and chart
    const vizContainer = container.append("div")
        .attr("class", "state-select-container")
        .style("text-align", "center");

    // Add a dropdown menu for state selection
    const dropdown = vizContainer.append("select")
        .attr("id", "state-select")
        .on("change", function() {
            const selectedState = d3.select(this).property("value");
            drawStateCategoryChart(selectedState);
        });

    dropdown.selectAll("option")
        .data(states)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    // Draw the initial chart for the first state in the list
    drawStateCategoryChart(states[0]);

    function drawStateCategoryChart(selectedState) {
        // Clear any existing chart
        vizContainer.select("svg").remove();

        const dataForState = profitByStateAndCategory.get(selectedState);
        const dataArray = dataForState ? Array.from(dataForState) : [];

        // Create the SVG container for this scene.
        const svg = vizContainer.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Define scales for x (category) and y (profit).
        const x = d3.scaleBand()
            .domain(dataArray.map(d => d[0]))
            .range([0, width])
            .padding(0.1);

        const maxProfit = d3.max(dataArray, d => d[1]);
        const minProfit = d3.min(dataArray, d => d[1]);
        const y = d3.scaleLinear()
            .domain([Math.min(0, minProfit), maxProfit])
            .nice()
            .range([height, 0]);

        // Draw the bars.
        svg.selectAll(".bar")
            .data(dataArray, d => d[0])
            .join("rect")
            .attr("class", "bar")
            .attr("x", d => x(d[0]))
            .attr("y", d => y(Math.max(0, d[1])))
            .attr("width", x.bandwidth())
            .attr("height", d => Math.abs(y(d[1]) - y(0)))
            .attr("fill", d => d[1] > 0 ? "#007bff" : "#dc3545");

        // Add axes.
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append("g")
            .call(d3.axisLeft(y));

        // Add chart title.
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("text-decoration", "underline")
            .text(`Profit by Category in ${selectedState}`);
            
        // Add annotations to highlight key categories.
        const sortedData = dataArray.sort((a, b) => b[1] - a[1]);
        const annotations = [];

        if (sortedData.length > 0) {
            annotations.push({
                note: {
                    label: `Highest profit: $${sortedData[0][1].toFixed(2)}`,
                    title: `Highest Profit: ${sortedData[0][0]}`
                },
                data: { category: sortedData[0][0] },
                dx: 50,
                dy: -20,
                subject: {
                    y1: y(0),
                    y2: y(sortedData[0][1])
                }
            });

            const lowestProfitCategory = sortedData[sortedData.length - 1];
            if (lowestProfitCategory[1] < 0) {
                 annotations.push({
                    note: {
                        label: `Lowest profit: $${lowestProfitCategory[1].toFixed(2)}`,
                        title: `Major Loss: ${lowestProfitCategory[0]}`
                    },
                    data: { category: lowestProfitCategory[0] },
                    dx: -50,
                    dy: 20,
                    subject: {
                        y1: y(0),
                        y2: y(lowestProfitCategory[1])
                    }
                });
            }
        }
    
        if (annotations.length > 0) {
            const makeAnnotations = d3.annotation()
                .type(d3.annotationCalloutRect)
                .accessors({
                    x: d => x(d.category) + x.bandwidth() / 2,
                    y: d => y(dataArray.find(item => item[0] === d.category)[1])
                })
                .annotations(annotations);

            svg.append("g").call(makeAnnotations);
        }
    }
}

// --- SCENE 2: PROFIT BY CATEGORY (BAR CHART) ---
function drawScene2BarChart() {
    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add chart title.
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("text-decoration", "underline")
        .text("Nation Wide Total Profit by Category");

    // Define scales for x (category) and y (profit).
    const x = d3.scaleBand()
        .domain(Array.from(profitByCategory.keys()))
        .range([0, width])
        .padding(0.1);

    const maxProfit = d3.max(Array.from(profitByCategory.values()));
    const minProfit = d3.min(Array.from(profitByCategory.values()));
    const y = d3.scaleLinear()
        .domain([minProfit, maxProfit])
        .nice()
        .range([height, 0]);

    // Draw the bars using the .join() pattern for D3 v7
    svg.selectAll(".bar")
        .data(Array.from(profitByCategory))
        .join("rect")
        .attr("class", "bar")
        .attr("x", d => x(d[0]))
        .attr("y", d => y(Math.max(0, d[1])))
        .attr("width", x.bandwidth())
        .attr("height", d => Math.abs(y(d[1]) - y(0)))
        .attr("fill", "#007bff");

    // Add axes.
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .call(d3.axisLeft(y));

    // Add annotations to highlight key categories.
    const annotations = [{
        note: {
            label: "Technology contributes the most to overall profit.",
            title: "Highest Profit"
        },
        data: { category: "Technology" },
        dx: -20,
        dy: -40,
        subject: {
            y1: y(0),
            y2: y(profitByCategory.get("Technology"))
        }
    }, {
        note: {
            label: "Furniture has a much lower profit margin.",
            title: "Lower Profit"
        },
        data: { category: "Furniture" },
        dx: 40,
        dy: 20,
        subject: {
            y1: y(0),
            y2: y(profitByCategory.get("Furniture"))
        }
    }, {
        note: {
            label: "Profit",
            bgPadding: 5,
            title: "Profit"
        },
        data: { category: "Technology" },
        dx: 50,
        dy: -100,
        subject: {
            y1: y(profitByCategory.get("Technology")),
            y2: y(profitByCategory.get("Technology")),
            x: 0,
            x2: -50,
            width: 0,
            height: 0,
            radius: 0
        },
        connector: {
            end: "dot"
        }
    }];

    const makeAnnotations = d3.annotation()
        .type(d3.annotationCalloutRect)
        .accessors({
            x: d => x(d.category) + x.bandwidth() / 2,
            y: d => y(profitByCategory.get(d.category))
        })
        .annotations(annotations);

    svg.append("g").call(makeAnnotations);
}

// --- SCENE 3: PROFIT VS DISCOUNT (SCATTER PLOT) ---
function drawScene3ScatterPlot() {
    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define scales for x (discount) and y (profit).
    const x = d3.scaleLinear()
        .domain(d3.extent(superstoreData, d => d.Discount)).nice()
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain(d3.extent(superstoreData, d => d.Profit)).nice()
        .range([height, 0]);

    // Define a color scale for categories.
    const color = d3.scaleOrdinal()
        .domain(Array.from(new Set(superstoreData.map(d => d.Category))))
        .range(["#4682b4", "#da70d6", "#f08080"]); // Custom colors for our categories

    // Draw the scatter points.
    svg.selectAll("circle")
        .data(superstoreData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.Discount))
        .attr("cy", d => y(d.Profit))
        .attr("r", 3.5)
        .attr("fill", d => color(d.Category))
        .attr("opacity", 0.6)
        .on("mouseover", function(event, d) {
            // Tooltip logic for free-form interaction.
            d3.select("body").select(".tooltip")
                .html(`Product: ${d["Product Name"]}<br>Category: ${d.Category}<br>Profit: $${d.Profit.toFixed(2)}<br>Discount: ${d.Discount * 100}%`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px")
                .style("opacity", 1);
        })
        .on("mouseout", function() {
            d3.select("body").select(".tooltip").style("opacity", 0);
        });

    // Add axes.
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .call(d3.axisLeft(y));

    // Add annotations to highlight key trends.
    const annotations = [{
        note: {
            label: "High discounts often lead to significant losses.",
            title: "Discount Impact"
        },
        data: { Discount: 0.5, Profit: -1000 },
        dx: 50,
        dy: -20,
        subject: {
            radius: 20
        }
    }, {
        note: {
            label: "The majority of sales occur with no discount.",
            title: "Zero Discount Sales"
        },
        data: { Discount: 0.05, Profit: 500 },
        dx: -10,
        dy: 50,
        subject: {
            radius: 20
        }
    }];

    const makeAnnotations = d3.annotation()
        .type(d3.annotationCalloutCircle)
        .accessors({
            x: d => x(d.Discount),
            y: d => y(d.Profit)
        })
        .annotations(annotations);

    svg.append("g").call(makeAnnotations);

    // Append the tooltip element to the body.
    d3.select("body").append("div")
        .attr("class", "tooltip");
}
