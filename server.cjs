// configure express and Next.js

const next = require("next")
const express = require("express")
const {createServer} = require("http")
const Websocket = require("ws")


const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handler = app.getRequestHandler();



    const server = express()
    const httpServer = createServer(server)
    const watchers = new Map();

    httpServer.on("connection", (ws, req) => {
        const productId = req.url.split("/").pop();

        if (!productId) {
            return
        }

        // incremet the watchers count for the product  
        const currentCount = ( watchers.get(productId) || 0) + 1;
        watchers.set(productId, currentCount);

        console.log(`User joined Product ID: ${productId}, Current watchers: ${currentCount}`);

        // notify all connected clients about the new watcher count
        watchers.get(productId)?.forEach((client) => {
            if (client.readyState === Websocket.OPEN) {
                client.send(JSON.stringify({
                    type: "WATCHER_COUNT",
                    productId,
                    count: currentCount
                }))
            }
        })
        // handle disconnection
        ws.on("close", () => {
            const updatedCount = Math.max((watchers.get(productId) || 0) - 1)
            
            if (updatedCount === 0) {
                watchers.delete(productId);
            } else {
                watchers.set(productId, updatedCount)
            }

            console.log(
                `User left Product ID: ${productId}, Current watchers: ${updatedCount}`
            )

            // notify remaining clients
            watchers.get(productId)?.forEach((client) => {
                if (client.readyState === Websocket.OPEN) {
                    client.send(JSON.stringify({
                        type: "WATCHER_COUNT",
                        productId,
                        count: updatedCount
                    }))
                }
            })
        })

        // send initial message
        ws.send(JSON.stringify({
            message: "Connected to live server",
            currentViewers: currentCount,
            productId: productId,
            timestamp: new Date().toISOString()
        }))
    })

    server.all("/{*splat}", (req, res) => {
        console.log(req.url, "-----------------------");
        return handler(req, res)
    })

    httpServer.listen(4005, (err) => {
        if (err) throw new err
        console.log('Server is listening on http://localhost:4005');
    })
