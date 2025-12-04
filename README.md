
# PixelPlanet – Internal Technical Overview

This document explains **how PixelPlanet works internally**: APIs, WebSocket messages, pixel placement flow, cooldown logic, canvas system, storage, and important backend functions.  

---

## 1. High-level Architecture

PixelPlanet is built around these main components:

- **Client (browser)**  
  Renders the canvas, requests tiles, sends pixel placement commands over WebSocket, and displays updates.

- **Web Server (Node.js/Express)**  
  Serves static files, REST API endpoints, manages authentication, rate-limits, and handles WebSocket upgrade.

- **WebSocket Server**  
  Handles real-time communication: pixel placements, chunk updates, user events.

- **Redis**  
  Stores pixel data and chunk states. Provides high-speed reads/writes for real-time canvas.

- **MySQL / MariaDB**  
  Stores user accounts, ban lists, IP data, usage logs, and metadata.

---

## 2. Canvas System

PixelPlanet uses multiple canvases, each defined inside a config file (usually `canvases.json`).  
A canvas entry contains:

- `name` – Display name  
- `size` – Must be power of 4 (256 → 65536)  
- `bcd` – Base cooldown for empty pixel placement  
- `pcd` – Cooldown when placing on an existing pixel  
- `cds` – Stack cooldown (when rapid repainting is allowed)  
- `cli` – Number of palette colors ignored for “background”  
- `req` – Required total pixels before user can paint  
- `v` – Whether canvas uses 3D voxels

Internally:

- Canvas data is split into **chunks** (typically 64×64)  
- Each chunk is stored in **Redis** as binary buffers  
- Chunk keys follow a pattern similar to:  
```

canvas:<id>:chunk:<cx>:<cy>

```
- Requests for visible chunks come from the client as the camera moves.

---

## 3. Pixel Placement Flow

When a player places a pixel:

1. Client sends a WebSocket message:  
```

[type=PLACE_PIXEL, x, y, color, canvasId]

```

2. Server receives message and:
- Validates user (IP blocks, account, captcha when enabled)
- Checks cooldown timestamp
- Validates coordinates and color

3. Server updates Redis chunk buffer for that pixel:
- Load chunk  
- Modify pixel within chunk  
- Save chunk back

4. Server broadcasts an update:  
```

[type=PIXEL_UPDATE, x, y, color, canvasId]

```

5. All connected clients update that pixel on-screen.

Cooldown calculations are based on:
- The previous pixel timestamp
- Whether the pixel was empty or non-empty
- Stack rules

---

## 4. Cooldown System

Each user has a tracked timestamp in Redis or memory.  
Cooldown types:

- **Base Cooldown (bcd)**  
Applied if pixel was empty  
- **Overwrite Cooldown (pcd)**  
Applied if replacing another pixel  
- **Stack Cooldown (cds)**  
Allows re-painting same coordinates after a short interval

Logic (simplified):

```

if target_pixel_is_empty:
cooldown = bcd
else:
cooldown = pcd

if user_is_stack_placing:
cooldown = cds

```

Cooldown is stored per user/IP.

---

## 5. WebSocket Protocol

Actual names may vary by version, but the core message types are:

### Incoming (Client → Server)
```

PLACE_PIXEL
REQUEST_CHUNK
REQUEST_ONLINE_COUNT
PING
AUTH_LOGIN / AUTH_REGISTER

```

### Outgoing (Server → Client)
```

PIXEL_UPDATE
CHUNK_DATA
ONLINE_COUNT
COOLDOWN_UPDATE
SERVER_MESSAGE
PONG

```

Messages are usually sent as:
- compact binary packets, or
- small string arrays (depending on version)

Chunk messages include:
- chunk coordinates
- raw pixel buffer (compressed or uncompressed)
- canvas id

---

## 6. REST API Endpoints

PixelPlanet exposes simple REST endpoints for:

### Authentication
```

POST /api/register
POST /api/login
POST /api/logout

```

### User Info
```

GET /api/profile
GET /api/cooldown

```

### Tile / Canvas Data
```

GET /api/canvas/<id>/info
GET /api/canvas/<id>/pixel?x=&y=

```

### Admin (if enabled)
```

POST /api/admin/ban
POST /api/admin/unban

```

### Proxy / IP Checks (optional)
If enabled through environment variables:
```

/api/proxycheck

```

### Static Assets
```

/tiles/<canvas>/<chunk>.png
/previews/<canvas>.png

```

---

## 7. Rate Limit System

There are **three main layers** of protection:

### 1. IP-based Request Limits  
Used for REST endpoints (login, account creation, etc).

### 2. WebSocket Throttling  
Prevents sending pixel placement spam or excessive chunk requests.

### 3. Cooldown System  
Hard-limits pixel placements with dynamic timers.

If **USE_PROXYCHECK=1**, additional rate penalties may apply for VPN/proxy flagged IPs.

---

## 8. Storage Details

### Redis  
Used for:
- Pixel/chunk data  
- User cooldown timestamps  
- Online user count  
- Temporary states  
- Pixel placement queues  

Typical key formats:
```

canvas:<id>:chunk:<cx>:<cy>
user:<id>:cooldown
stats:online

```

### MySQL  
Used for:
- User accounts  
- Login sessions  
- Ban records  
- Historical logs (optional)  
- Meta tables for canvas data  

Example tables:
```

users
ip_bans
pixel_logs
sessions

```

---

## 9. Backup System

PixelPlanet includes a backup script that:

- Dumps whole canvas to PNG on interval  
- Optionally generates incremental diffs  
- Supports public historical view  
- Stores backups to `BACKUP_DIR`

Backup configuration:
```

BACKUP_URL
BACKUP_DIR
BACKUP_INTERVAL

```

3D canvases (v=1) **do not support** the backup system.

---

## 10. Asset Requirements

Each canvas requires:

```

loading<ID>.png
preview<ID>.png
assets3d/normal<ID>.jpg
assets3d/specular<ID>.jpg

```

These provide:
- loading screen
- preview tile for map selector
- 3D visualization textures (if applicable)

---

## 11. Important Backend Functions (Simplified)

### Pixel placement:
```

placePixel(user, x, y, color, canvasId):
checkCooldown(user)
chunk = loadChunk(canvasId, x, y)
updateChunkPixel(chunk, x, y, color)
saveChunk(chunk)
broadcastPixelUpdate(...)

```

### Chunk loading:
```

loadChunk(canvasId, x, y):
cx = floor(x / 64)
cy = floor(y / 64)
return redis.get("canvas:<id>:chunk:<cx>:<cy>")

```

### Cooldown calculation:
```

getCooldown(user):
now = timestamp()
if now < user.nextAvailable:
return user.nextAvailable - now
return 0

```

### WebSocket broadcast:
```

broadcast("PIXEL_UPDATE", payload):
for client in clientsInCanvas:
client.send(payload)

```

---

## 12. Summary

PixelPlanet works by:

- Splitting giant canvases into Redis-backed chunks  
- Communicating over WebSocket for real-time pixel updates  
- Using MySQL for persistent accounts and logs  
- Enforcing cooldowns, rate limits, and optional proxy controls  
- Broadcasting updates to all active players  
- Allowing multiple canvas types (flat, globe, voxel)

---

