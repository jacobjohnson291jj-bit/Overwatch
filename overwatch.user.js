
// ==UserScript==
// @name OVERWATCH
// @version 0.3.0
// @description OVERWATCH Compact Item Market Test
// ==/UserScript==

(function () {
    "use strict";

    const API_KEY = "###PDA-APIKEY###";
    const ITEM_ID = 206;

    function startOverwatch() {
        if (document.getElementById("overwatch-tab")) return;

        const tab = document.createElement("button");
        tab.id = "overwatch-tab";
        tab.textContent = "OW";
        tab.style.cssText = `
            position:fixed;
            bottom:110px;
            right:8px;
            z-index:999999;
            width:46px;
            height:42px;
            border:1px solid #64748b;
            border-radius:10px;
            background:#111820;
            color:#8ee0a0;
            font-weight:bold;
            font-size:15px;
        `;

        const panel = document.createElement("div");
        panel.id = "overwatch-panel";
        panel.style.cssText = `
            display:none;
            position:fixed;
            bottom:160px;
            right:8px;
            z-index:999998;
            width:280px;
            max-width:85vw;
            max-height:55vh;
            overflow:auto;
            background:#111820;
            color:white;
            padding:14px;
            border:2px solid #64748b;
            border-radius:12px;
            font-family:Arial,sans-serif;
            box-sizing:border-box;
        `;

        const title = document.createElement("h3");
        title.textContent = "OVERWATCH";
        title.style.cssText =
            "color:#8ee0a0;margin:0 0 8px;font-size:21px;";

        const tagline = document.createElement("p");
        tagline.textContent = "Find the newest profitable prices.";
        tagline.style.cssText = "margin:0 0 12px;font-size:13px;";

        const button = document.createElement("button");
        button.textContent = "TEST ITEM MARKET";
        button.style.cssText = `
            width:100%;
            padding:12px;
            background:#187747;
            color:white;
            border:0;
            border-radius:8px;
            font-weight:bold;
            font-size:14px;
        `;

        const output = document.createElement("pre");
        output.style.cssText = `
            white-space:pre-wrap;
            overflow-wrap:anywhere;
            font-size:11px;
            max-height:220px;
            overflow:auto;
            color:#d1d5db;
            margin-bottom:0;
        `;

        panel.append(title, tagline, button, output);
        document.body.append(tab, panel);

        tab.addEventListener("click", function () {
            const opening = panel.style.display === "none";
            panel.style.display = opening ? "block" : "none";
            tab.textContent = opening ? "×" : "OW";
        });

        button.addEventListener("click", async function () {
            button.disabled = true;
            output.textContent = "Checking Item Market...";

            try {
                if (typeof window.PDA_httpGet !== "function") {
                    throw new Error("Torn PDA HTTP helper not found.");
                }

                const url =
                    "https://api.torn.com/v2/market/" +
                    ITEM_ID + "/itemmarket?key=" +
                    encodeURIComponent(API_KEY);

                const response = await window.PDA_httpGet(url);

                if (!response || response.status < 200 ||
                    response.status >= 300) {
                    throw new Error(
                        "HTTP error: " +
                        (response ? response.status : "No response")
                    );
                }

                const data = JSON.parse(response.responseText);

                if (data.error) {
                    throw new Error(
                        data.error.error || "Torn API returned an error."
                    );
                }

                const market = data.itemmarket;
                const listings = market && market.listings;

                let report =
                    "API CONNECTION SUCCESSFUL!\n\n" +
                    "HTTP status: " + response.status + "\n" +
                    "Item ID: " + ITEM_ID + "\n" +
                    "Item data received: " + !!market + "\n" +
                    "Listings array found: " +
                    Array.isArray(listings) + "\n";

                if (Array.isArray(listings)) {
                    report +=
                        "Listings returned: " + listings.length + "\n\n" +
                        "FIRST LISTINGS:\n" +
                        JSON.stringify(listings.slice(0, 10), null, 2);
                } else {
                    report +=
                        "\nUnexpected response structure.\n\n" +
                        "Received data:\n" +
                        JSON.stringify(data, null, 2).slice(0, 3500);
                }

                output.textContent = report;

            } catch (error) {
                output.textContent =
                    "TEST FAILED\n\n" + error.message;
            } finally {
                button.disabled = false;
            }
        });
    }

    if (document.body) {
        startOverwatch();
    } else {
        document.addEventListener(
            "DOMContentLoaded",
            startOverwatch
        );
    }
})();
