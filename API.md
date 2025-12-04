
# API.md – PixelPlanet Protocol and API Reference

This document explains **all major APIs**, **WebSocket message structures**, **pixel placement flow**, **chunk data formats**, and **internal protocol rules** used by the PixelPlanet server.
This is based on how the source code behaves

---

# 1. Overview

PixelPlanet uses **two interfaces**:

1. **REST API (HTTP/HTTPS)**  
   - Login, registration  
   - Canvas metadata  
   - Pixel queries  
   - Profile endpoints  

2. **WebSocket API**  
   - Real-time pixel placement  
   - Chunk streaming  
   - Cooldown updates  
   - Online count  
   - Global / system messages  

---

# 2. REST API

All REST endpoints are served under:
```

/api/

````

Most responses follow:
```json
{
  "success": true,
  "data": { ... }
}
````

Errors follow:

```json
{
  "success": false,
  "error": "reason"
}
```

---

## 2.1 Authentication

### POST /api/register

Registers a new user.

**Request:**

```json
{
  "name": "username",
  "password": "password123",
  "captcha": "token"      // if recaptcha enabled
}
```

**Response:**

```
success / error
```

---

### POST /api/login

Logs user in.

**Request:**

```json
{
  "name": "username",
  "password": "password123"
}
```

**Response:**

* HTTP-only session cookie is set
* JSON confirmation

---

### POST /api/logout

Ends user session.

---

## 2.2 User Information

### GET /api/profile

Returns logged-in user's profile.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "User",
    "pixelsPlaced": 10000,
    "registered": true
  }
}
```

---

### GET /api/cooldown

Returns remaining cooldown (in milliseconds).

**Response:**

```json
{
  "success": true,
  "cooldown": 1200
}
```

---

## 2.3 Canvas Metadata

### GET /api/canvas/<id>/info

Returns metadata for a specific canvas.

**Response Example:**

```json
{
  "success": true,
  "id": 1,
  "name": "Earth",
  "size": 65536,
  "cooldowns": {
    "bcd": 3000,
    "pcd": 5000,
    "cds": 60000
  },
  "colors": 30,
  "requiresPixels": 0,
  "is3D": false
}
```

---

### GET /api/canvas/<id>/pixel?x=&y=

Fetches the color of a single pixel.

**Response:**

```json
{
  "success": true,
  "color": 12
}
```

---

## 2.4 Other Endpoints

### GET /api/online

Returns current online users.

```json
{
  "online": 413
}
```

---

### Admin Endpoints (requires auth + admin flags)

```
POST /api/admin/ban
POST /api/admin/unban
POST /api/admin/setcooldown
```

Request and response format depends on tool.

---

# 3. WebSocket API

PixelPlanet uses a binary or JSON-array WebSocket protocol.

Connection URL (typical):

```
wss://<server>/ws
```

After connecting, the server sends:

```
[HELLO, serverVersion, motd]
```

Clients must send periodic `PING` packets.

---

# 3.1 Incoming Messages (Client → Server)

### PLACE_PIXEL

```
[PLACE_PIXEL, x, y, color, canvasId]
```

Fields:

* `x`, `y` – global coordinates
* `color` – palette index
* `canvasId` – which canvas

Server rejects invalid colors, out-of-bounds coords, or cooldown violations.

---

### REQUEST_CHUNK

Requests chunk tile.

```
[REQUEST_CHUNK, cx, cy, canvasId]
```

`cx`, `cy` are chunk coordinates (not pixel coordinates).
Typical chunk size: 64×64 pixels.

---

### REQUEST_ONLINE_COUNT

```
[REQUEST_ONLINE_COUNT]
```

---

### AUTH_LOGIN / AUTH_REGISTER

Only used if login via WebSocket is enabled (alternative flow).

Format:

```
[AUTH_LOGIN, username, password]
```

---

### PING

```
[PING]
```

---

# 3.2 Outgoing Messages (Server → Client)

### PIXEL_UPDATE

Broadcasted when any user places a pixel.

```
[PIXEL_UPDATE, x, y, color, canvasId]
```

---

### CHUNK_DATA

Returned when client requests chunk.

```
[CHUNK_DATA, cx, cy, canvasId, rawBytes]
```

`rawBytes` is usually a compressed or direct binary buffer representing 4096 pixels.

---

### COOLDOWN_UPDATE

Sent after a placement or when querying cooldown.

```
[COOLDOWN_UPDATE, msRemaining]
```

---

### ONLINE_COUNT

```
[ONLINE_COUNT, number]
```

---

### SERVER_MESSAGE

Used for system announcements.

```
[SERVER_MESSAGE, "text"]
```

---

### PONG

Response to client ping.

```
[PONG]
```

---

# 4. Chunk Format

Chunks are typically:

* 64×64 pixels
* 4096 bytes (1 byte per pixel color index)
* Sometimes compressed before sending

Key in Redis:

```
canvas:<id>:chunk:<cx>:<cy>
```

Binary format (uncompressed):

```
byte[0] = color at (0,0)
byte[1] = color at (1,0)
...
byte[4095] = color at (63,63)
```

---

# 5. Pixel Placement Validation

Server checks:

1. User session or IP
2. Bans or proxy restrictions
3. Cooldown time
4. Canvas requirements (req)
5. Valid palette ID
6. Coordinate within world size

---

# 6. Cooldown Logic

Three cooldown types:

```
bcd = base cooldown (empty pixel)
pcd = overwrite cooldown (non-empty pixel)
cds = stacking cooldown (fast repaint)
```

Cooldown is:

```
if previous_color == 0:
    cooldown = bcd
else:
    cooldown = pcd

if stackingAllowed:
    cooldown = cds
```

Stored as:

```
user:<id>:cooldown
```

Or IP-based fallback for guests.

---

# 7. Rate Limits

PixelPlanet uses:

### HTTP rate limits

* Login attempts
* Registration
* Profile queries

### WebSocket throttling

* Chunk request limits
* Pixel placement frequency

### IP checks (optional)

If `USE_PROXYCHECK` is enabled, suspicious IPs get extended cooldown or block.

---

# 8. Redis Key Structure

Common keys:

```
canvas:<id>:chunk:<cx>:<cy>     // main pixel storage
user:<id>:cooldown              // per-user cooldown
stats:online                    // live count
ban:ip:<ip>                     // banned ip
```

---

# 9. MySQL Tables (typical)

```
users           // accounts
pixel_logs      // historical pixel placements
sessions        // user sessions
ip_bans         // ban entries
proxy_cache     // proxy/VPN detection cache
```

---

# 10. Error Codes

WebSocket error messages:

```
[ERROR, "cooldown"]
[ERROR, "invalid_color"]
[ERROR, "out_of_bounds"]
[ERROR, "not_allowed"]
```

REST errors:

```
{ success: false, error: "unauthorized" }
{ success: false, error: "invalid" }
{ success: false, error: "rate_limited" }
```

---

```
```
