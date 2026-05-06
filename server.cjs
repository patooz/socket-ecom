// configure express and Next.js

const next = require("next")
const express = require("express")
const {createServer} = require("http")
const Websocket = require("ws")


const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT || 4005;
const app = next({ dev });
const handler = app.getRequestHandler();

app.prepare().then(() => {
    const server = express()
    const httpServer = createServer(server)
    // Map of productId -> Set of connected WebSocket clients
    const watchers = new Map();

    // Create WebSocket server on top of the HTTP server
    const wss = new Websocket.Server({ server: httpServer });

    wss.on("connection", (ws, req) => {
        // Parse productId from the URL (e.g. ws://localhost:4005/product123)
        const productId = req.url && req.url.split("/").pop();

        if (!productId) {
            ws.close();
            return;
        }

        // Add this client to the watchers set for the product
        if (!watchers.has(productId)) {
            watchers.set(productId, new Set());
        }
        watchers.get(productId).add(ws);

        const currentCount = watchers.get(productId).size;

        console.log(`User joined Product ID: ${productId}, Current watchers: ${currentCount}`);

        // Notify all connected clients about the new watcher count
        broadcastToProduct(productId);

        // Send initial message to the new client
        ws.send(JSON.stringify({
            message: "Connected to live server",
            currentViewers: currentCount,
            productId: productId,
            timestamp: new Date().toISOString()
        }));

        // Handle disconnection
        ws.on("close", () => {
            const clients = watchers.get(productId);
            if (clients) {
                clients.delete(ws);

                if (clients.size === 0) {
                    watchers.delete(productId);
                } else {
                    broadcastToProduct(productId);
                }
            }

            const updatedCount = watchers.get(productId)?.size || 0;
            console.log(`User left Product ID: ${productId}, Current watchers: ${updatedCount}`);
        });
    });

    // Helper: broadcast current watcher count to all clients watching a product
    function broadcastToProduct(productId) {
        const clients = watchers.get(productId);
        if (!clients) return;

        const message = JSON.stringify({
            type: "WATCHER_COUNT",
            productId,
            count: clients.size
        });

        clients.forEach((client) => {
            if (client.readyState === Websocket.OPEN) {
                client.send(message);
            }
        });
    }

    server.all("/{*splat}", (req, res) => {
        return handler(req, res)
    })

    httpServer.listen(port, (err) => {
        if (err) throw err
        console.log(`Server is listening on port ${port}...`);
    })
})
