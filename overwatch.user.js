// ==UserScript==
// @name OVERWATCH
// @version 0.1.2
// @description OVERWATCH Bazaar Directory Connection Test
// ==/UserScript==

(function () {
    "use strict";

    const API_KEY = "###PDA-APIKEY###";
    const ITEM_ID = 206;

    function startOverwatch() {
        if (document.getElementById("overwatch-test")) return;

        const box = document.createElement("div");
        box.id = "overwatch-test";

        box.style.cssText = `
            position:fixed;
            bottom:20px;
            right:12px;
            z-index:999999;
            background:#111820;
            color:white;
            padding:14px;
            border:2px solid #64748b;
            border-radius:12px;
            width:280px;
            font-family:Arial,sans-serif;
        `;

        const title = document.createElement("h3");
        title.textContent = "OVERWATCH";
        title.style.color = "#8ee0a0";

        const tagline = document.createElement("p");
        tagline.textContent = "Find the newest profitable prices.";

        const button = document.createElement("button");
        button.textContent = "TEST XANAX DIRECTORY";
        button.style.cssText =
            "width:100%;padding:12px;background:#187747;color:white;border:0;border-radius:8px;font-weight:bold;";

        const output = document.createElement("pre");
        output.style.cssText =
            "white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:250px;overflow:auto;color:#d1d5db;";

        box.append(title, tagline, button, output);
        document.body.appendChild(box);

        button.addEventListener("click", async function () {
            button.disabled = true;
            output.textContent = "Connecting to Torn API...";

            try {
                if (!API_KEY || API_KEY.includes("###")) {
                    throw new Error("PDA API key placeholder was not replaced.");
                }

                if (typeof window.PDA_httpGet !== "function") {
                    throw new Error("Torn PDA HTTP helper not found.");
                }

                const url =
                    "https://api.torn.com/v2/market/" +
                    ITEM_ID + "/bazaar?key=" +
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

                output.textContent =
                    "CONNECTION SUCCESSFUL!\n\n" +
                    "HTTP status: " + response.status + "\n\n" +
                    "Torn API response:\n" +
                    JSON.stringify(data, null, 2).slice(0, 5000);

            } catch (error) {
                output.textContent =
                    "CONNECTION TEST FAILED\n\n" +
                    error.message;
            } finally {
                button.disabled = false;
            }
        });
    }

    if (document.body) {
        startOverwatch();
    } else {
        document.addEventListener("DOMContentLoaded", startOverwatch);
    }
})();
