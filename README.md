# AIFAIS MCP Server ⚡

De officiële Model Context Protocol (MCP) server voor AIFAIS. Geef je AI agents (zoals Claude of Cursor) direct toegang tot specialistische tools voor de Nederlandse markt.

## 🚀 Quick Start (via `npx`)

De makkelijkste manier om de server te gebruiken is via `npx`. Je hoeft dan niets lokaal te installeren of te builden.

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

## 🛠️ Lokale Ontwikkeling

Als je de server wilt aanpassen of lokaal wilt draaien:

1. **Installatie**:
   ```bash
   npm install
   ```

2. **Configuratie**:
   Maak een `.env` bestand aan op basis van `.env.example`:
   ```env
   AIFAIS_API_URL=https://aifais.com/api/v1/scan
   DEBUG=true
   ```

3. **Builden**:
   ```bash
   npm run build
   ```

4. **Starten**:
   ```bash
   npm start
   ```

---

## 💎 Beschikbare Tools

### `scan_invoice`
Scant een factuur of bonnetje (PDF/JPG/PNG) en extraheert gestructureerde data via AI.

**Parameters:**
- `invoiceBase64` (required): De base64 string van het bestand.
- `mimeType` (required): `application/pdf`, `image/jpeg` of `image/png`.
- `signature` (optional): De Solana transactie signature als bewijs van betaling.

---

## 💳 Betalingen (X402 Protocol)

Deze server maakt gebruik van het **X402 (Payment Required)** protocol. Dit betekent:
1. De agent doet een verzoek zonder `signature`.
2. De server antwoordt met een `402 Error` en geeft een Solana wallet adres + bedrag (0.001 SOL).
3. Jij (of je agent) betaalt de transactie.
4. De agent stuurt het verzoek opnieuw, maar nu met de `signature`.

Dit zorgt voor een frictieloze pay-per-call ervaring zonder dat je een account of API key nodig hebt.

---

## 🪵 Debugging

Als je problemen ervaart, kun je `DEBUG=true` aanzetten in je environment. Logs worden naar `stderr` geschreven zodat ze de MCP communicatie niet verstoren.

In Claude Desktop kun je de logs bekijken via:
`~/Library/Logs/Claude/mcp.log` (macOS)
`%APPDATA%/Claude/logs/mcp.log` (Windows)

---

## 📝 Licentie

MIT © AIFAIS
