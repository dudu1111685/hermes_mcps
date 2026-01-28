# Security & Authentication

⚠️ **DO NOT EXPOSE WAHA ON PUBLIC NETWORKS!**
Always protect with API keys + firewall.

## Quick Setup (TLDR)

### Generate Secrets
```bash
uuidgen | tr -d '-'  # Generate random key
# Output: 6c35dcbf31914c65a90f29e2ca1840d2
```

### Set Environment Variables
```bash
# .env or docker-compose.yaml
WAHA_API_KEY=yoursecretkey
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=yourpassword
WHATSAPP_SWAGGER_USERNAME=admin
WHATSAPP_SWAGGER_PASSWORD=yourpassword
```

### Use API Key
```bash
curl -H 'X-Api-Key: yoursecretkey' http://localhost:3000/api/sessions
```

## API Key Authentication

### Hash API Key (Recommended)
```bash
# 1. Generate key
uuidgen | tr -d '-'
# Output: 00000000000000000000000000000000

# 2. Hash with SHA512
echo -n "00000000000000000000000000000000" | shasum -a 512
# Output: 98b6d128...24648

# 3. Set hashed key
WAHA_API_KEY=sha512:98b6d128682e280b74b324ca82a6bae6e8a3f7174e0605bfd52eb9948fad8984854ec08f7652f32055c4a9f12b69add4850481d9503a7f2225501671d6124648

# 4. Use plain key in requests
X-Api-Key: 00000000000000000000000000000000
```

### Plain API Key (Less Secure)
```bash
WAHA_API_KEY=yoursecretkey
```

### Test API Key
```bash
# No key → 401
curl http://localhost:3000/api/sessions

# Wrong key → 401
curl -H 'X-Api-Key: wrong' http://localhost:3000/api/sessions

# Right key → []
curl -H 'X-Api-Key: yoursecretkey' http://localhost:3000/api/sessions
```

### Exclude Endpoints
```bash
# Exclude health/ping from auth
WAHA_API_KEY_EXCLUDE_PATH=health,ping

# Exclude media files
WHATSAPP_API_KEY_EXCLUDE_PATH=api/files/(.*),ping,health
```

## Keys API (Dynamic Keys)

### List Keys
```bash
GET /api/keys
```

### Create Admin Key
```bash
POST /api/keys
{
  "isAdmin": true,
  "session": null,
  "isActive": true
}
```

### Create Session-Scoped Key
```bash
POST /api/keys
{
  "isAdmin": false,
  "session": "default",
  "isActive": true
}
```

### Update Key
```bash
PUT /api/keys/{id}
{ "isActive": false }
```

### Delete Key
```bash
DELETE /api/keys/{id}
```

## Dashboard Security

```bash
WAHA_DASHBOARD_ENABLED=true
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=strongpassword
```

Access: http://localhost:3000/dashboard

## Swagger Security

```bash
WHATSAPP_SWAGGER_ENABLED=true
WHATSAPP_SWAGGER_USERNAME=admin
WHATSAPP_SWAGGER_PASSWORD=strongpassword
```

⚠️ Swagger password ≠ API protection! Use both.

## Webhook Security

### HMAC Authentication
```json
{
  "webhooks": [{
    "url": "https://your-webhook.com",
    "events": ["message"],
    "hmac": {
      "key": "your-secret-key"
    }
  }]
}
```

**Verify HMAC:**
1. Get headers:
   - `X-Webhook-Hmac`: Message authentication code
   - `X-Webhook-Hmac-Algorithm`: `sha512`
2. Hash body with secret key
3. Compare with `X-Webhook-Hmac`

**Test:**
- Body: `{"event":"message","session":"default"}`
- Key: `my-secret-key`
- Algorithm: `sha512`
- Expected HMAC: `208f8a55dde9e05519e898b10b89bf0d0b3b0fdf11fdbf09b6b90476301b98d8097c462b2b17a6ce93b6b47a136cf2e78a33a63f6752c2c1631777076153fa89`

### Custom Headers
```json
{
  "webhooks": [{
    "customHeaders": [
      { "name": "X-Custom-Header", "value": "secret" }
    ]
  }]
}
```

## HTTPS Setup

### With Nginx (Recommended)
Use reverse proxy for SSL termination.

### Built-in HTTPS (Deprecated)
```bash
WAHA_HTTPS_ENABLED=true
WAHA_HTTPS_PATH_KEY=/path/to/privkey.pem
WAHA_HTTPS_PATH_CERT=/path/to/cert.pem
WAHA_HTTPS_PATH_CA=/path/to/chain.pem
```

## Disable Security (NOT RECOMMENDED!)

```bash
# API Key - OFF
WAHA_API_KEY=
WAHA_NO_API_KEY=True

# Dashboard - Auth OFF
WAHA_DASHBOARD_PASSWORD=
WAHA_DASHBOARD_NO_PASSWORD=True

# Swagger - Auth OFF
WHATSAPP_SWAGGER_PASSWORD=
WHATSAPP_SWAGGER_NO_PASSWORD=True
```

## Headers in Webhooks

### Standard Headers
- `X-Webhook-Request-Id`: Unique request ID
- `X-Webhook-Timestamp`: Unix timestamp (ms)

### HMAC Headers
- `X-Webhook-Hmac`: Authentication code
- `X-Webhook-Hmac-Algorithm`: `sha512`

## Best Practices
1. **Always use API keys** in production
2. **Hash API keys** (sha512 format)
3. **Use HTTPS** (reverse proxy)
4. **Enable HMAC** for webhooks
5. **Firewall rules** to restrict access
6. **Rotate keys** periodically
7. **Session keys** for per-session access
8. **Monitor access logs** for suspicious activity
9. **Exclude media** carefully (files have random names)
10. **Never commit** keys to git
