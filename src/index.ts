import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.AIFAIS_API_URL || "https://aifais.com/api/agent/scan";

const server = new Server(
    {
        name: "aifais-mcp-server",
        version: "1.1.0",
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
    if (request.params.name === "scan_invoice") {
        const { invoiceBase64, mimeType, signature } = request.params.arguments as {
            invoiceBase64: string;
            mimeType: string;
            signature?: string;
        };

        try {
            const response = await axios.post(
                API_URL,
                {
                    invoiceBase64,
                    mimeType,
                    signature: signature || "",
                },
                { validateStatus: () => true }
            );

            // Handle Success
            if (response.status === 200) {
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
                const offer = response.data.x402_offer || response.data;
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `🛑 PAYMENT REQUIRED (X402)\n\nAmount: ${offer.amount} ${offer.currency || "SOL"}\nRecipient: ${offer.address || offer.recipient}\nReference: ${offer.memo || "Invoice Scan"}\n\nPlease pay to receive the data.`,
                        },
                    ],
                };
            }

            // Handle other errors
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `API Error (${response.status}): ${JSON.stringify(response.data)}`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Internal Connection Error: ${error.message}`,
                    },
                ],
            };
        }
    }

    throw new Error(`Tool not found: ${request.params.name}`);
});

/**
 * Start the server
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("AIFAIS MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
