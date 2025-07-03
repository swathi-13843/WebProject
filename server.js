const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const uuid = require('uuid');
const os = require('os');

// Configuration
const PORT = process.env.PORT || 3000;
const MAX_MESSAGE_HISTORY = 200;

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Data stores
const clients = new Map();
const messageHistory = [];
const typingUsers = new Set();

// Helper functions
function getIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function addToHistory(message) {
  messageHistory.push(message);
  if (messageHistory.length > MAX_MESSAGE_HISTORY) {
    messageHistory.shift();
  }
}

function broadcast(message) {
  if (!this.clients) return; // Skip if no clients
  
  const data = JSON.stringify(message);
  this.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Routes
app.get('/', (req, res) => {
  res.send('Chat server is operational');
});

app.get('/api/messages', (req, res) => {
  res.json(messageHistory.slice(-100));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server with port fallback
function startServer(port = PORT) {
  const server = app.listen(port, () => {
    console.log(`
    Server running at:
    - Local:    http://localhost:${port}
    - Network:  http://${getIPAddress()}:${port}
    `);
    console.log(`WebSocket available at ws://localhost:${port}`);
  });

  const wss = new WebSocket.Server({ server });

  // Attach broadcast to wss instance
  wss.broadcast = broadcast.bind(wss);

  wss.on('connection', (ws) => {
    const userId = uuid.v4();
    let username = `User-${Math.floor(Math.random() * 1000)}`;
    let userColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
    
    clients.set(ws, { userId, username, userColor });

    // Send initial data to client
    ws.send(JSON.stringify({
      type: 'init',
      data: {
        userId,
        username,
        userColor,
        history: messageHistory.slice(-100),
        onlineUsers: Array.from(clients.values()).map(user => ({
          id: user.userId,
          name: user.username,
          color: user.userColor
        }))
      }
    }));

    // Broadcast new user connection
    wss.broadcast({
      type: 'user-joined',
      data: { userId, username, userColor }
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'set-username':
            username = message.data;
            clients.set(ws, { userId, username, userColor });
            wss.broadcast({
              type: 'user-updated',
              data: { userId, username, userColor }
            });
            break;
            
          case 'message':
            const msgData = {
              id: uuid.v4(),
              userId,
              username,
              userColor,
              text: message.data,
              timestamp: new Date().toISOString(),
              reactions: {}
            };
            addToHistory(msgData);
            wss.broadcast({
              type: 'new-message',
              data: msgData
            });
            break;
            
          case 'typing':
            if (message.data) {
              typingUsers.add(userId);
            } else {
              typingUsers.delete(userId);
            }
            wss.broadcast({
              type: 'typing-users',
              data: Array.from(typingUsers)
            });
            break;
            
          case 'react':
            const msg = messageHistory.find(m => m.id === message.data.messageId);
            if (msg) {
              msg.reactions[message.data.reaction] = (msg.reactions[message.data.reaction] || 0) + 1;
              wss.broadcast({
                type: 'message-reaction',
                data: {
                  messageId: message.data.messageId,
                  reactions: msg.reactions
                }
              });
            }
            break;
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      typingUsers.delete(userId);
      wss.broadcast({
        type: 'user-left',
        data: { userId }
      });
      wss.broadcast({
        type: 'typing-users',
        data: Array.from(typingUsers)
      });
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server startup error:', err);
    }
  });
}

// Global error handlers
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Start the server
startServer();