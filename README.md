# AIFAIS MCP Server ⚡

De officiële Model Context Protocol (MCP) server voor AIFAIS. Geef je AI agents (zoals Claude of Cursor) direct toegang tot specialistische tools voor de Nederlandse markt.

## 🚀 Quick Start

### Voor Claude Desktop
Voeg dit toe aan je `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aifais": {
      "command": "npx",
      "args": ["-y", "github:aifais/aifais-mcp-server"]
    }
  }
}
```

### Voor Cursor IDE
1. Ga naar **Settings** -> **Features** -> **MCP**.
2. Klik op **+ Add MCP Server**.
3. Kies type **command**.
4. Gebruik als command: `npx -y github:aifais/aifais-mcp-server`.

---

## 💎 Beschikbare Tools

### `scan_invoice`
Scant een factuur/bonnetje en extraheert gestructureerde data via AI.

**Parameters:**
- `invoiceBase64 (required)`
- `mimeType (required)`
- `signature (optional)`


---

## 💳 Pricing

Elke API call kost **0.001 SOL** via het X402 protocol.

**Hoe het werkt:**
1. De agent doet een verzoek zonder `signature`.
2. De server antwoordt met een `402 Error` en geeft een Solana wallet adres + bedrag.
3. Jij (of je agent) betaalt de transactie.
4. De agent stuurt het verzoek opnieuw, maar nu met de `signature`.

Wallet: `Bqpo3emFG46VGLX4korYoeta3a317pWbR2DMbWnFpZ8c`

---

## 🛠️ Lokale Ontwikkeling

```bash
npm install
npm run build
npm start
```

Configuratie via `.env`:
```env
AIFAIS_API_URL=https://aifais.com/api/v1/scan
DEBUG=true
```

---

## 🪵 Debugging

Zet `DEBUG=true` aan in je environment. Logs worden naar `stderr` geschreven.

---

## 📝 Licentie

MIT © AIFAIS

---

*Auto-generated from website docs. Version 1.2.0*
