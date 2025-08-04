let currentSceneIndex = 0;
let superstoreData = [];
let profitByState = new Map();
let profitByCategory = new Map();
let profitByStateAndCategory = new Map();
const scenes = 3;

const margin = { top: 100, right: 40, bottom: 60, left: 60 };
const width = 960 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const container = d3.select("#visualization-container");
const prevButton = d3.select("#prev-button");
const nextButton = d3.select("#next-button");
const sceneIndicator = d3.select("#scene-indicator");

Promise.all([
    d3.csv("superstore.csv")
]).then(function (data) {
    superstoreData = data[0];

    superstoreData.forEach(d => {
        d.Profit = +d.Profit;
        d.Discount = +d.Discount;
        d.Sales = +d.Sales;
        d.Quantity = +d.Quantity;
    });

    profitByState = new Map(d3.rollup(superstoreData, v => d3.sum(v, d => d.Profit), d => d.State));
    profitByCategory = new Map(d3.rollup(superstoreData, v => d3.sum(v, d => d.Profit), d => d.Category));
    profitByStateAndCategory = new Map(d3.rollup(superstoreData, v => d3.sum(v, d => d.Profit), d => d.State, d => d.Category));

    updateScene(currentSceneIndex);
    setupControls();
}).catch(function (error) {
    console.error("Error loading data:", error);
    container.append("p")
        .style("color", "red")
        .text("Error: Could not load data. Please ensure 'superstore.csv' is in the same directory and you are running a local web server.");
});

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
    container.select("svg").remove();
    container.select(".state-select-container").remove();
    d3.select("body").select(".tooltip").remove();

    prevButton.property("disabled", currentSceneIndex === 0);
    nextButton.property("disabled", currentSceneIndex === scenes - 1);
    sceneIndicator.text(`Scene ${currentSceneIndex + 1} of ${scenes}`);

    if (sceneIndex === 0) drawScene1StateSelectorChart();
    else if (sceneIndex === 1) drawScene2BarChart();
    else if (sceneIndex === 2) drawScene3ScatterPlot();
}

function drawScene1StateSelectorChart() {
    const states = Array.from(profitByState.keys()).sort();
    const vizContainer = container.append("div")
        .attr("class", "state-select-container")
        .style("text-align", "center");

    const dropdown = vizContainer.append("select")
        .attr("id", "state-select")
        .on("change", function () {
            drawStateCategoryChart(d3.select(this).property("value"));
        });

    dropdown.selectAll("option")
        .data(states)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    drawStateCategoryChart(states[0]);

    function drawStateCategoryChart(selectedState) {
        vizContainer.select("svg").remove();
        const dataForState = profitByStateAndCategory.get(selectedState);
        const dataArray = dataForState ? Array.from(dataForState) : [];

        const svg = vizContainer.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

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

        svg.selectAll(".bar")
            .data(dataArray, d => d[0])
            .join("rect")
            .attr("class", "bar")
            .attr("x", d => x(d[0]))
            .attr("y", d => y(Math.max(0, d[1])))
            .attr("width", x.bandwidth())
            .attr("height", d => Math.abs(y(d[1]) - y(0)))
            .attr("fill", d => d[1] > 0 ? "#007bff" : "#dc3545");

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append("g").call(d3.axisLeft(y));

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("text-decoration", "underline")
            .text(`Profit by Category in ${selectedState}`);

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

function drawScene2BarChart() {
    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("text-decoration", "underline")
        .text("Nation Wide Total Profit by Category");

    const x = d3.scaleBand()
        .domain(Array.from(profitByCategory.keys()))
        .range([0, width])
        .padding(0.1);

    const maxProfit = d3.max(Array.from(profitByCategory.values()));
    const minProfit = d3.min(Array.from(profitByCategory.values()));
    const y = d3.scaleLinear()
        .domain([Math.min(0, minProfit), maxProfit])
        .nice()
        .range([height, 0]);

    svg.selectAll(".bar")
        .data(Array.from(profitByCategory))
        .join("rect")
        .attr("class", "bar")
        .attr("x", d => x(d[0]))
        .attr("y", d => y(Math.max(0, d[1])))
        .attr("width", x.bandwidth())
        .attr("height", d => Math.abs(y(d[1]) - y(0)))
        .attr("fill", "#007bff");

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g").call(d3.axisLeft(y));

    const annotations = [
        {
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
        },
        {
            note: {
                label: "Furniture has a much lower profit margin.",
                title: "Lower Profit"
            },
            data: { category: "Furniture" },
            dx: 0,
            dy: -50,
            subject: {
                y1: y(profitByCategory.get("Furniture")),
                y2: y(profitByCategory.get("Furniture"))
            }
        }
    ];

    const makeAnnotations = d3.annotation()
        .type(d3.annotationCalloutRect)
        .accessors({
            x: d => x(d.category) + x.bandwidth() / 2,
            y: d => y(profitByCategory.get(d.category))
        })
        .annotations(annotations);

    svg.append("g").call(makeAnnotations);
}

function drawScene3ScatterPlot() {
    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("text-decoration", "underline")
        .text("Profit vs. Discount Analysis");

    const x = d3.scaleLinear()
        .domain(d3.extent(superstoreData, d => d.Discount)).nice()
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain(d3.extent(superstoreData, d => d.Profit)).nice()
        .range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(Array.from(new Set(superstoreData.map(d => d.Category))))
        .range(["#4682b4", "#da70d6", "#f08080"]);

    svg.selectAll("circle")
        .data(superstoreData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.Discount))
        .attr("cy", d => y(d.Profit))
        .attr("r", 3.5)
        .attr("fill", d => color(d.Category))
        .attr("opacity", 0.6)
        .on("mouseover", function (event, d) {
            d3.select("body").select(".tooltip")
                .html(`Product: ${d["Product Name"]}<br>Category: ${d.Category}<br>Profit: $${d.Profit.toFixed(2)}<br>Discount: ${d.Discount * 100}%`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px")
                .style("opacity", 1);
        })
        .on("mouseout", function () {
            d3.select("body").select(".tooltip").style("opacity", 0);
        });

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g").call(d3.axisLeft(y));

    const annotations = [
        {
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
        },
        {
            note: {
                label: "The majority of sales occur with no discount.",
                title: "Zero Discount Sales"
            },
            data: { Discount: 0.02, Profit: 400 },
            dx: 80,
            dy: -50,
            subject: {
                radius: 20
            }
        }
    ];

    const makeAnnotations = d3.annotation()
        .type(d3.annotationCalloutCircle)
        .accessors({
            x: d => x(d.Discount),
            y: d => y(d.Profit)
        })
        .annotations(annotations);

    svg.append("g").call(makeAnnotations);

    d3.select("body").append("div")
        .attr("class", "tooltip");
}
