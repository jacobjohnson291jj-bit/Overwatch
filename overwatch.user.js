// ==UserScript==
// @name OVERWATCH
// @version 0.5.0
// @description OVERWATCH Multi-Item Market Scanner (controlled batches)
// ==/UserScript==

(function () {
    "use strict";

    const API_KEY = "###PDA-APIKEY###";
    const MIN_PROFIT = 250000;
    const RESALE_DISCOUNT = 0.10;
    const BATCH_SIZE = 5;
    const REQUEST_DELAY = 3000;
    const STATE_KEY = "OVERWATCH_V05_STATE";

    let state = {
        items: [],
        cursor: 0,
        deals: [],
        scanned: 0,
        errors: 0,
        paused: false
    };

    let status, scanButton, output, running = false;

    function money(n) {
        return "$" + Math.round(n).toLocaleString("en-US");
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function saveState() {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn("OVERWATCH: state could not be saved", e);
        }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(STATE_KEY);
            if (saved) state = Object.assign(state, JSON.parse(saved));
        } catch (e) {
            console.warn("OVERWATCH: saved state unavailable", e);
        }
    }

    async function getJson(url) {
        if (typeof window.PDA_httpGet !== "function") {
            throw new Error("Torn PDA HTTP helper not found.");
        }

        const response = await window.PDA_httpGet(url);
        if (!response) throw new Error("No response from Torn API.");

        if (response.status === 429) {
            const error = new Error("Torn API rate limit (HTTP 429). Scanner paused.");
            error.rateLimited = true;
            throw error;
        }

        if (response.status < 200 || response.status >= 300) {
            throw new Error("HTTP " + response.status);
        }

        const data = JSON.parse(response.responseText);
        if (data.error) {
            const message = data.error.error || "Torn API error";
            const error = new Error(message);
            if (/too many requests|rate limit/i.test(message)) error.rateLimited = true;
            throw error;
        }
        return data;
    }

    function normalizeCatalogue(data) {
        let source = data.items || data.itemdetails || (data.torn && data.torn.items);
        if (Array.isArray(source)) return source;
        if (source && typeof source === "object") {
            return Object.keys(source).map(id => Object.assign({ id: Number(id) }, source[id]));
        }
        throw new Error("Could not recognize Torn item catalogue response.");
    }

    async function loadCatalogue() {
        status.textContent = "LOADING ITEM CATALOGUE...";
        const url = "https://api.torn.com/v2/torn/items?key=" + encodeURIComponent(API_KEY);
        const data = await getJson(url);

        state.items = normalizeCatalogue(data)
            .map(item => ({
                id: Number(item.id || item.ID),
                name: item.name || item.title || ("Item " + (item.id || item.ID))
            }))
            .filter(item => Number.isInteger(item.id) && item.id > 0)
            .sort((a, b) => a.id - b.id);

        if (!state.items.length) throw new Error("Catalogue returned no usable items.");
        state.cursor = 0;
        state.deals = [];
        state.scanned = 0;
        state.errors = 0;
        state.paused = false;
        saveState();
    }

    function median(values) {
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    function analyze(item, listings) {
        const rows = listings.map(listing => ({
            listing,
            price: Number(listing.price),
            quantity: Number(listing.amount ?? listing.quantity ?? listing.qty ?? 1)
        })).filter(row =>
            Number.isFinite(row.price) && row.price > 0 &&
            Number.isFinite(row.quantity) && row.quantity > 0
        );

        if (rows.length < 10) return [];

        const prices = rows.map(row => row.price).sort((a, b) => a - b);
        const middle = prices.slice(Math.floor(prices.length * 0.2), Math.ceil(prices.length * 0.8));
        if (middle.length < 5) return [];

        const benchmark = median(middle);
        const resale = benchmark * (1 - RESALE_DISCOUNT);

        return rows.map(row => {
            const unitProfit = resale - row.price;
            return {
                itemId: item.id,
                name: item.name,
                listingId: row.listing.ID ?? row.listing.id ?? "Unknown",
                price: row.price,
                quantity: Math.floor(row.quantity),
                resale,
                unitProfit,
                totalProfit: unitProfit * Math.floor(row.quantity)
            };
        }).filter(deal => deal.unitProfit > 0 && deal.totalProfit >= MIN_PROFIT);
    }

    function render() {
        if (!output) return;
        const deals = state.deals.slice().sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 25);
        const progress = state.items.length
            ? Math.floor(state.cursor / state.items.length * 100)
            : 0;

        let text = "OVERWATCH // MULTI-ITEM SCANNER\n";
        text += "================================\n";
        text += "Catalogue items: " + state.items.length + "\n";
        text += "Items scanned: " + state.scanned + "\n";
        text += "Progress: " + progress + "%\n";
        text += "API errors: " + state.errors + "\n";
        text += "Minimum estimated listing profit: " + money(MIN_PROFIT) + "\n\n";
        text += "TOP OPPORTUNITIES\n================================\n\n";

        if (!deals.length) text += "No qualifying opportunities found yet.\n\n";
        deals.forEach((deal, index) => {
            text += "#" + (index + 1) + " " + deal.name + " (ID " + deal.itemId + ")\n";
            text += "Buy: " + money(deal.price) + " | Qty: " + deal.quantity + "\n";
            text += "Estimated resale: " + money(deal.resale) + "\n";
            text += "Profit/item: " + money(deal.unitProfit) + "\n";
            text += "Estimated listing profit: " + money(deal.totalProfit) + "\n\n";
        });
        text += "Estimates use current asking prices minus a 10% safety discount; not confirmed sale prices.";
        output.textContent = text;
    }

    async function scanBatch() {
        if (running) return;
        running = true;
        scanButton.disabled = true;

        try {
            if (!state.items.length || state.cursor >= state.items.length) {
                await loadCatalogue();
            }

            state.paused = false;
            const stopAt = Math.min(state.cursor + BATCH_SIZE, state.items.length);

            while (state.cursor < stopAt) {
                const item = state.items[state.cursor];
                status.textContent = "SCANNING " + item.name + " (" + (state.cursor + 1) + "/" + state.items.length + ")";

                try {
                    const url = "https://api.torn.com/v2/market/" + item.id +
                        "/itemmarket?key=" + encodeURIComponent(API_KEY);
                    const data = await getJson(url);
                    const listings = data.itemmarket && data.itemmarket.listings;
                    if (Array.isArray(listings)) state.deals.push(...analyze(item, listings));
                    state.scanned++;
                } catch (error) {
                    state.errors++;
                    if (error.rateLimited) {
                        state.paused = true;
                        status.textContent = "RATE LIMITED — PAUSED";
                        output.textContent = "Torn has rate-limited requests. Progress is saved. Wait before pressing SCAN NEXT BATCH again.\n\n" + error.message;
                        break;
                    }
                    console.warn("OVERWATCH item " + item.id + " failed:", error);
                }

                state.cursor++;
                saveState();
                render();

                if (state.cursor < stopAt) await wait(REQUEST_DELAY);
            }

            if (!state.paused) {
                status.textContent = state.cursor >= state.items.length
                    ? "CATALOGUE SCAN COMPLETE"
                    : "BATCH COMPLETE — READY TO CONTINUE";
            }
        } catch (error) {
            status.textContent = "SCANNER ERROR";
            output.textContent = "Could not start scan:\n" + error.message;
        } finally {
            running = false;
            scanButton.disabled = false;
            saveState();
            render();
        }
    }

    function startOverwatch() {
        if (document.getElementById("overwatch-tab")) return;

        const tab = document.createElement("button");
        tab.id = "overwatch-tab";
        tab.textContent = "OW";
        tab.style.cssText = "position:fixed;bottom:110px;right:8px;z-index:999999;width:46px;height:42px;border:1px solid #64748b;border-radius:10px;background:#111820;color:#8ee0a0;font-weight:bold;font-size:15px;";

        const panel = document.createElement("div");
        panel.id = "overwatch-panel";
        panel.style.cssText = "display:none;position:fixed;bottom:160px;right:8px;z-index:999998;width:310px;max-width:88vw;max-height:65vh;overflow:auto;background:#111820;color:white;padding:14px;border:2px solid #64748b;border-radius:12px;font-family:Arial,sans-serif;box-sizing:border-box;";

        const title = document.createElement("h3");
        title.textContent = "OVERWATCH";
        title.style.cssText = "color:#8ee0a0;margin:0 0 5px;font-size:21px;";

        const tagline = document.createElement("p");
        tagline.textContent = "Multi-Item Market Intelligence";
        tagline.style.cssText = "margin:0 0 10px;font-size:12px;color:#94a3b8;";

        status = document.createElement("p");
        status.textContent = "SYSTEM READY";
        status.style.cssText = "color:#8ee0a0;font-size:11px;font-weight:bold;";

        scanButton = document.createElement("button");
        scanButton.textContent = "SCAN NEXT BATCH";
        scanButton.style.cssText = "width:100%;padding:12px;background:#187747;color:white;border:0;border-radius:8px;font-weight:bold;font-size:14px;";

        output = document.createElement("pre");
        output.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:350px;overflow:auto;color:#d1d5db;margin-bottom:0;line-height:1.5;";

        panel.append(title, tagline, status, scanButton, output);
        document.body.append(tab, panel);

        tab.addEventListener("click", function () {
            const opening = panel.style.display === "none";
            panel.style.display = opening ? "block" : "none";
            tab.textContent = opening ? "×" : "OW";
        });

        scanButton.addEventListener("click", scanBatch);
        if (state.items.length) render();
    }

    loadState();
    if (document.body) startOverwatch();
    else document.addEventListener("DOMContentLoaded", startOverwatch);
})();
