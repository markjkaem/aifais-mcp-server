#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.AIFAIS_API_BASE || "https://aifais.com/api/v1";
const DEBUG = process.env.DEBUG === "true";

/**
 * Enhanced Logging Utility
 */
const log = {
    info: (msg: string, ...args: any[]) => console.error(`[INFO] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => {
        if (DEBUG) console.error(`[DEBUG] ${msg}`, ...args);
    }
};

/**
 * Tool Definitions
 */
const TOOLS = {
    scan_invoice: {
        name: "scan_invoice",
        description: "Scans an invoice (PDF/JPG/PNG) and extracts structured data. Requires payment (X402).",
        endpoint: "/finance/scan",
        inputSchema: {
            type: "object",
            properties: {
                invoiceBase64: { type: "string", description: "Base64 encoded string of the invoice file" },
                mimeType: { type: "string", enum: ["image/png", "image/jpeg", "application/pdf"], description: "The MIME type of the file" },
                signature: { type: "string", description: "Solana transaction signature (payment proof)" },
            },
            required: ["invoiceBase64", "mimeType"],
        }
    },
    check_contract: {
        name: "check_contract",
        description: "Analyzes a legal contract for risks and missing clauses. Requires payment (0.01 SOL).",
        endpoint: "/legal/check-contract",
        inputSchema: {
            type: "object",
            properties: {
                contractBase64: { type: "string", description: "Base64 encoded PDF contract" },
                signature: { type: "string", description: "Solana transaction signature (payment proof)" },
            },
            required: ["contractBase64"],
        }
    },
    generate_terms: {
        name: "generate_terms",
        description: "Generates custom Terms & Conditions for a company. Requires payment (0.005 SOL).",
        endpoint: "/legal/generate-terms",
        inputSchema: {
            type: "object",
            properties: {
                companyName: { type: "string" },
                companyType: { type: "string", description: "e.g. BV, Eenmanszaak" },
                industry: { type: "string" },
                hasPhysicalProducts: { type: "boolean" },
                hasDigitalProducts: { type: "boolean" },
                hasServices: { type: "boolean" },
                acceptsReturns: { type: "boolean" },
                returnDays: { type: "number" },
                paymentTerms: { type: "number", description: "Days to pay invoice" },
                jurisdiction: { type: "string", description: "e.g. Amsterdam, Nederland" },
                signature: { type: "string", description: "Solana transaction signature" },
            },
            required: ["companyName", "companyType", "paymentTerms", "jurisdiction"],
        }
    },
    create_invoice: {
        name: "create_invoice",
        description: "Generates a professional PDF invoice. Free tool.",
        endpoint: "/finance/create-invoice",
        inputSchema: {
            type: "object",
            properties: {
                ownName: { type: "string" },
                ownAddress: { type: "string" },
                clientName: { type: "string" },
                clientAddress: { type: "string" },
                invoiceNumber: { type: "string" },
                invoiceDate: { type: "string" },
                expiryDate: { type: "string" },
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            description: { type: "string" },
                            quantity: { type: "number" },
                            price: { type: "number" },
                            vatRate: { type: "number" }
                        }
                    }
                }
            },
            required: ["ownName", "clientName", "items"],
        }
    }
};

/**
 * Retry helper for transient network errors
 */
async function axiosWithRetry(url: string, data: any, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.post(url, data, { validateStatus: () => true });
        } catch (error: any) {
            const isTransient = !error.response || (error.response.status >= 500);
            if (i === retries - 1 || !isTransient) throw error;

            const delay = backoff * Math.pow(2, i);
            log.info(`Transient error, retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error("Max retries reached");
}

const server = new Server(
    {
        name: "aifais-mcp-server",
        version: "1.3.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    log.debug("Listing tools...");
    return {
        tools: Object.values(TOOLS).map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
        })),
    };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = TOOLS[name as keyof typeof TOOLS];

    if (!tool) {
        throw new Error(`Tool not found: ${name}`);
    }

    log.info(`Tool call: ${name}`);
    log.debug("Arguments:", JSON.stringify(args, null, 2));

    try {
        const url = `${BASE_URL}${tool.endpoint}`;
        const response = await axiosWithRetry(url, args);

        log.debug(`API Response Status: ${response.status}`);

        // Handle Success
        if (response.status === 200) {
            log.info("Operation successful");
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
                        text: `🛑 PAYMENT REQUIRED (X402)\n\nTo complete this action, please send a Solana transaction:\n\nAmount: ${offer.amount} ${offer.currency || "SOL"}\nRecipient: ${offer.address || offer.recipient}\nReference/Memo: ${offer.memo || name}\n\nOnce paid, call this tool again with the transaction signature in the 'signature' field.`,
                    },
                ],
            };
        }

        // Handle Errors
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

    } catch (error: any) {
        log.error("Connection error", error.message);
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Network/Connection Error: ${error.message}. Please check if the AIFAIS API is reachable at ${BASE_URL}.`,
                },
            ],
        };
    }
});

/**
 * Start the server
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info(`AIFAIS MCP Server v1.3.0 running on stdio (Base API: ${BASE_URL})`);
}

main().catch((error) => {
    log.error("Fatal error in main():", error);
    process.exit(1);
});

