# Installation & Setup

This guide walks you through installing and setting up WAHA MCP Server.

## Prerequisites

Before you begin, ensure you have:

### Required
- **Node.js 18 or higher** - [Download](https://nodejs.org/)
- **npm or yarn** - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)

### WAHA Setup
You need a running WAHA (WhatsApp HTTP API) instance. Choose one option:

#### Option 1: Docker (Recommended)

```bash
docker run -it -p 3001:3000 devlikeapro/waha
```

#### Option 2: Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  waha:
    image: devlikeapro/waha
    ports:
      - "3001:3000"
    environment:
      - WHATSAPP_API_KEY=your-secret-key
    volumes:
      - ./waha-data:/app/.waha
```

Run:
```bash
docker-compose up -d
```

#### Option 3: Cloud/Hosted

Use a hosted WAHA service like:
- [WAHA Cloud](https://waha.devlike.pro/docs/how-to/cloud/)
- Your own VPS deployment

---

## Install WAHA MCP

### Step 1: Clone the Repository

```bash
git clone https://github.com/dudu1111685/waha-mcp.git
cd waha-mcp
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
WAHA_API_KEY=your-api-key-here
WAHA_URL=http://localhost:3001
```

Or export them:

```bash
export WAHA_API_KEY="your-api-key-here"
export WAHA_URL="http://localhost:3001"
```

### Get Your WAHA API Key

1. Access WAHA dashboard: `http://localhost:3001/dashboard`
2. Navigate to **Settings** → **API Keys**
3. Generate a new API key
4. Copy and save it securely

---

## Verify Installation

Test the connection:

```bash
node dist/index.js
```

You should see:
```
WAHA MCP Server running on stdio
Connected to WAHA at http://localhost:3001
```

---

## Next Steps

- [Configure for Claude Desktop](./02-configuration.md#claude-desktop)
- [Configure for Cline/VS Code](./02-configuration.md#cline)
- [Run your first command](./03-quickstart.md)

---

## Troubleshooting

### "Cannot find module" Error

```bash
npm install
npm run build
```

### Connection Refused

1. Check WAHA is running: `curl http://localhost:3001/api/sessions`
2. Verify `WAHA_URL` matches your WAHA instance
3. Check firewall/network settings

### API Key Invalid

1. Regenerate key in WAHA dashboard
2. Update `.env` file
3. Restart the MCP server

See [Troubleshooting Guide](./15-troubleshooting.md) for more help.
