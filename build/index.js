#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
const API_URL = process.env.AIFAIS_API_URL || "https://aifais.com/api/v1/scan";
const DEBUG = process.env.DEBUG === "true";
/**
 * Enhanced Logging Utility
 */
const log = {
    info: (msg, ...args) => console.error(`[INFO] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
    debug: (msg, ...args) => {
        if (DEBUG)
            console.error(`[DEBUG] ${msg}`, ...args);
    }
};
/**
 * Retry helper for transient network errors
 */
async function axiosWithRetry(url, data, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.post(url, data, { validateStatus: () => true });
        }
        catch (error) {
            const isTransient = !error.response || (error.response.status >= 500);
            if (i === retries - 1 || !isTransient)
                throw error;
            const delay = backoff * Math.pow(2, i);
            log.info(`Transient error, retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error("Max retries reached");
}
const server = new Server({
    name: "aifais-mcp-server",
    version: "1.2.0",
}, {
    capabilities: {
        tools: {},
    },
});
/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    log.debug("Listing tools...");
    return {
        tools: [
            {
                name: "scan_invoice",
                description: "Scans an invoice (PDF/JPG/PNG) and extracts structured data. Requires payment (X402).",
                inputSchema: {
                    type: "object",
                    properties: {
                        invoiceBase64: {
                            type: "string",
                            description: "Base64 encoded string of the invoice file",
                        },
                        mimeType: {
                            type: "string",
                            enum: ["image/png", "image/jpeg", "application/pdf"],
                            description: "The MIME type of the file",
                        },
                        signature: {
                            type: "string",
                            description: "Solana transaction signature (payment proof)",
                        },
                    },
                    required: ["invoiceBase64", "mimeType"],
                },
            },
        ],
    };
});
/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log.info(`Tool call: ${name}`);
    log.debug("Arguments:", JSON.stringify(args, null, 2));
    if (name === "scan_invoice") {
        const { invoiceBase64, mimeType, signature } = args;
        if (!invoiceBase64) {
            return {
                isError: true,
                content: [{ type: "text", text: "Error: invoiceBase64 is required" }]
            };
        }
        try {
            const response = await axiosWithRetry(API_URL, {
                invoiceBase64,
                mimeType,
                signature: signature || "",
            });
            log.debug(`API Response Status: ${response.status}`);
            // Handle Success
            if (response.status === 200) {
                log.info("Scan successful");
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(response.data.data || response.data, null, 2),
                        },
                    ],
                };
            }
            // Handle X402 Payment Required
            if (response.status === 402) {
                const offer = response.data.details || response.data.x402_offer || response.data;
                log.info("Payment required (402)");
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `🛑 PAYMENT REQUIRED (X402)\n\nTo complete this scan, please send a Solana transaction:\n\nAmount: ${offer.amount} ${offer.currency || "SOL"}\nRecipient: ${offer.address || offer.recipient}\nReference/Memo: ${offer.memo || "Invoice Scan"}\n\nOnce paid, call this tool again with the transaction signature in the 'signature' field.`,
                        },
                    ],
                };
            }
            // Handle 400 Unreadable or Invalid
            if (response.status === 400) {
                log.error("Invalid request or unreadable document");
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `Bad Request: ${response.data.error || "The document might be unreadable or the input is invalid."}`,
                        },
                    ],
                };
            }
            // Handle other errors
            log.error(`API Error ${response.status}`, response.data);
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `API Error (${response.status}): ${response.data.error || JSON.stringify(response.data)}`,
                    },
                ],
            };
        }
        catch (error) {
            log.error("Connection error", error.message);
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Network/Connection Error: ${error.message}. Please check if the AIFAIS API is reachable.`,
                    },
                ],
            };
        }
    }
    throw new Error(`Tool not found: ${name}`);
});
/**
 * Start the server
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info(`AIFAIS MCP Server v1.2.0 running on stdio (API: ${API_URL})`);
}
main().catch((error) => {
    log.error("Fatal error in main():", error);
    process.exit(1);
});
