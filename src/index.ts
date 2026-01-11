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
    info: (msg: string, ...args: unknown[]) => console.error(`[INFO] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[ERROR] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => {
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
    generate_quote: {
        name: "generate_quote",
        description: "Generates a professional PDF quote. Free tool.",
        endpoint: "/finance/generate-quote",
        inputSchema: {
            type: "object",
            properties: {
                companyName: { type: "string" },
                clientName: { type: "string" },
                projectTitle: { type: "string" },
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            description: { type: "string" },
                            quantity: { type: "number" },
                            price: { type: "number" },
                        }
                    }
                },
                validUntil: { type: "number" }
            },
            required: ["companyName", "clientName", "projectTitle", "items"],
        }
    },
    cv_screener: {
        name: "cv_screener",
        description: "Analyzes and scores a CV against a job description. Requires payment (0.001 SOL).",
        endpoint: "/hr/cv-screener",
        inputSchema: {
            type: "object",
            properties: {
                cvBase64: { type: "string", description: "Base64 encoded CV file" },
                mimeType: { type: "string", description: "MIME type of the file" },
                jobDescription: { type: "string" },
                signature: { type: "string", description: "Solana transaction signature" }
            },
            required: ["cvBase64", "mimeType", "jobDescription"],
        }
    },
    interview_questions: {
        name: "interview_questions",
        description: "Generates personalized interview questions. Requires payment (0.001 SOL).",
        endpoint: "/hr/interview-questions",
        inputSchema: {
            type: "object",
            properties: {
                jobTitle: { type: "string" },
                jobDescription: { type: "string" },
                experienceLevel: { type: "string", enum: ["junior", "medior", "senior"] },
                questionCount: { type: "number" },
                signature: { type: "string", description: "Solana transaction signature" }
            },
            required: ["jobTitle", "jobDescription", "experienceLevel"],
        }
    },
    social_planner: {
        name: "social_planner",
        description: "Generates social media content plan. Requires payment (0.001 SOL).",
        endpoint: "/marketing/social-planner",
        inputSchema: {
            type: "object",
            properties: {
                topic: { type: "string" },
                platforms: { type: "array", items: { type: "string", enum: ["linkedin", "instagram", "facebook", "twitter", "tiktok"] } },
                postCount: { type: "number" },
                tone: { type: "string" },
                includeHashtags: { type: "boolean" },
                signature: { type: "string", description: "Solana transaction signature" }
            },
            required: ["topic", "platforms"],
        }
    },
    lead_scorer: {
        name: "lead_scorer",
        description: "Scores and prioritizes leads. Requires payment (0.001 SOL).",
        endpoint: "/sales/lead-scorer",
        inputSchema: {
            type: "object",
            properties: {
                companyName: { type: "string" },
                industry: { type: "string" },
                companySize: { type: "string" },
                budget: { type: "string" },
                engagement: {
                    type: "object",
                    properties: {
                        websiteVisits: { type: "number" },
                        emailOpens: { type: "number" },
                        demoRequested: { type: "boolean" },
                        downloadedContent: { type: "boolean" }
                    }
                },
                notes: { type: "string" },
                signature: { type: "string", description: "Solana transaction signature" }
            },
            required: ["companyName", "industry", "companySize"],
        }
    },
    pitch_deck: {
        name: "pitch_deck",
        description: "Generates a pitch deck structure. Requires payment (0.001 SOL).",
        endpoint: "/sales/pitch-deck",
        inputSchema: {
            type: "object",
            properties: {
                companyName: { type: "string" },
                productService: { type: "string" },
                targetAudience: { type: "string" },
                problemSolution: { type: "string" },
                uniqueValue: { type: "string" },
                askAmount: { type: "string" },
                slideCount: { type: "number" },
                signature: { type: "string", description: "Solana transaction signature" }
            },
            required: ["companyName", "productService", "targetAudience", "problemSolution", "uniqueValue"],
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
    },
    price_calculator: {
        name: "price_calculator",
        description: "Calculates optimal product pricing based on costs, margins, and market analysis with AI-powered insights. Free tool.",
        endpoint: "/finance/price-calculator",
        inputSchema: {
            type: "object",
            properties: {
                productName: { type: "string", description: "Name of the product" },
                costPrice: { type: "number", description: "Cost price per unit" },
                targetMargin: { type: "number", description: "Target profit margin percentage (0-100)" },
                competitorPrices: { type: "array", items: { type: "number" }, description: "Array of competitor prices for analysis" },
                marketPosition: { type: "string", enum: ["budget", "mid-range", "premium"], description: "Market positioning strategy" },
                includeVAT: { type: "boolean", description: "Include VAT in calculations" },
                vatRate: { type: "number", description: "VAT percentage (default 21%)" },
                quantity: { type: "number", description: "Quantity for bulk calculations" },
                additionalCosts: {
                    type: "object",
                    properties: {
                        shipping: { type: "number" },
                        packaging: { type: "number" },
                        marketing: { type: "number" },
                        overhead: { type: "number" }
                    },
                    description: "Additional costs per unit"
                }
            },
            required: ["productName", "costPrice"],
        }
    },
    btw_calculator: {
        name: "btw_calculator",
        description: "Calculates Dutch VAT (BTW) amounts. Supports adding VAT to net amounts or extracting VAT from gross amounts. Free tool.",
        endpoint: "/finance/btw-calculator",
        inputSchema: {
            type: "object",
            properties: {
                amount: { type: "number", description: "The amount to calculate VAT for" },
                vatRate: { type: "string", enum: ["9", "21"], description: "VAT rate: 9% (low) or 21% (standard)" },
                calculationType: { type: "string", enum: ["addVat", "removeVat"], description: "addVat: net→gross, removeVat: gross→net" },
                amounts: { type: "array", items: { type: "number" }, description: "Optional: batch calculate multiple amounts" }
            },
            required: ["amount"],
        }
    },
    salary_calculator: {
        name: "salary_calculator",
        description: "Calculates Dutch net salary from gross salary with official 2024/2025 tax rates. Includes arbeidskorting, algemene heffingskorting, 30% ruling, company car taxation, and more. Free tool.",
        endpoint: "/hr/salary-calculator",
        inputSchema: {
            type: "object",
            properties: {
                grossSalary: { type: "number", description: "Gross salary amount" },
                period: { type: "string", enum: ["monthly", "yearly"], description: "Salary period (default: monthly)" },
                taxYear: { type: "string", enum: ["2024", "2025"], description: "Tax year for calculations (default: 2025)" },
                partTimePercentage: { type: "number", description: "Part-time percentage 1-100 (default: 100)" },
                holidayAllowanceIncluded: { type: "boolean", description: "Whether holiday allowance (8%) is included in gross salary" },
                thirteenthMonth: { type: "boolean", description: "Whether 13th month is included in gross salary" },
                pensionContributionEmployee: { type: "number", description: "Employee pension contribution percentage (0-30)" },
                pensionContributionEmployer: { type: "number", description: "Employer pension contribution percentage (0-30)" },
                ruling30Percent: { type: "boolean", description: "Apply 30% ruling for expats" },
                under30WithMasters: { type: "boolean", description: "Under 30 with masters degree (affects 30% ruling threshold)" },
                companyCar: {
                    type: "object",
                    properties: {
                        catalogValue: { type: "number", description: "Catalog value of the car" },
                        isElectric: { type: "boolean", description: "Is the car electric" },
                        isHydrogen: { type: "boolean", description: "Is the car hydrogen powered" }
                    },
                    description: "Company car details for bijtelling calculation"
                },
                commuteDistance: { type: "number", description: "One-way commute distance in km for travel allowance" },
                calculationMode: { type: "string", enum: ["gross-to-net", "net-to-gross"], description: "Calculation direction (default: gross-to-net)" }
            },
            required: ["grossSalary"],
        }
    }
};

/**
 * Retry helper for transient network errors
 */
async function axiosWithRetry(url: string, data: Record<string, unknown>, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.post(url, data, { validateStatus: () => true });
        } catch (error: unknown) {
            const axiosError = error as { response?: { status: number } };
            const isTransient = !axiosError.response || (axiosError.response.status >= 500);
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
        version: "1.4.0",
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
        const response = await axiosWithRetry(url, (args ?? {}) as Record<string, unknown>);

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

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error("Connection error", errorMessage);
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Network/Connection Error: ${errorMessage}. Please check if the AIFAIS API is reachable at ${BASE_URL}.`,
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
    log.info(`AIFAIS MCP Server v1.4.0 running on stdio (Base API: ${BASE_URL})`);
}

main().catch((error) => {
    log.error("Fatal error in main():", error);
    process.exit(1);
});

