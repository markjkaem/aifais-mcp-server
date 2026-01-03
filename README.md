# AIFAIS MCP Server Migration

This folder contains the standalone version of the AIFAIS MCP server.

## Installation

1. Copy the contents of this folder to your `aifais-mcp-server` directory.
2. Run `npm install` to install dependencies.
3. Use `npm run build` to compile the TypeScript code.
4. Run `npm start` to start the server.

## Configuration

Set the follow environment variable in a `.env` file:
`AIFAIS_API_URL=https://aifais.com/api/agent/scan`

## Features

- **scan_invoice**: Integrated tool with full X402 (Payment Required) support.
- **TypeScript**: Modern codebase with type safety.
- **Standalone**: Ready to be used with Claude Desktop or Cursor.
