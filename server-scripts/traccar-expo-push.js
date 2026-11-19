/**
 * GIANT EYE TECH - Traccar to Expo Push Notification Forwarder
 * 
 * Runs on your Traccar Server (149.102.142.158)
 * Receives webhook events from Traccar and pushes real-time alerts
 * to customers' Android and iPhone lock screens via Expo Push Service.
 * 
 * Setup on Traccar Server:
 * 1. Add to /opt/traccar/conf/traccar.xml:
 *    <entry key='event.forward.enable'>true</entry>
 *    <entry key='event.forward.url'>http://localhost:5055/event</entry>
 * 
 * 2. Start this forwarder:
 *    node traccar-expo-push.js
 *    (or with PM2: pm2 start traccar-expo-push.js --name "gps-push")
 */

const http = require('http');

const PORT = process.env.PORT || 5055;
const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

// Basic Auth credentials of Traccar Admin (to look up user tokens)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const event = payload.event || payload;
        const device = payload.device || { name: `Vehicle #${event.deviceId || ''}` };

        console.log(`[Push Server] Event received: ${event.type} for ${device.name}`);

        const notificationContent = formatNotification(event, device);

        // Fetch users permitted to see this device
        const users = await getDeviceUsers(event.deviceId);

        // Collect all Expo push tokens
        const tokens = [];
        for (const user of users) {
          if (user.attributes && user.attributes.notificationTokens) {
            const userTokens = user.attributes.notificationTokens.split(',');
            userTokens.forEach(t => {
              const cleaned = t.trim();
              if (cleaned.startsWith('ExponentPushToken')) {
                tokens.push(cleaned);
              }
            });
          }
        }

        if (tokens.length > 0) {
          console.log(`[Push Server] Sending push to ${tokens.length} recipient(s)...`);
          await sendExpoPush(tokens, notificationContent.title, notificationContent.body, {
            deviceId: event.deviceId,
            eventId: event.id,
            type: event.type,
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', tokensSent: tokens.length }));
      } catch (err) {
        console.error('[Push Server] Error processing event:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('GPS Track Expo Push Forwarder is running.\n');
  }
});

// Format title and body for notification
function formatNotification(event, device) {
  const name = device.name || 'Vehicle';
  switch (event.type) {
    case 'geofenceExit':
      return {
        title: '🚨 Geofence Exited',
        body: `${name} has exited the designated geofence!`,
      };
    case 'geofenceEnter':
      return {
        title: '📍 Geofence Entered',
        body: `${name} has entered the designated geofence.`,
      };
    case 'deviceOverspeed':
      return {
        title: '⚡ Overspeed Alert',
        body: `${name} exceeded the maximum speed limit!`,
      };
    case 'alarm':
      return {
        title: '🛑 SOS / Shock Alarm',
        body: `Urgent alarm triggered by ${name}!`,
      };
    case 'ignitionOn':
      return {
        title: '🔑 Engine Started',
        body: `${name} ignition was turned ON.`,
      };
    case 'ignitionOff':
      return {
        title: '🛑 Engine Stopped',
        body: `${name} ignition was turned OFF.`,
      };
    case 'deviceOnline':
      return {
        title: '📶 Tracker Online',
        body: `${name} is connected and transmitting GPS signal.`,
      };
    case 'deviceOffline':
      return {
        title: '⚠️ Tracker Offline',
        body: `${name} lost GPS / GSM connection.`,
      };
    default:
      return {
        title: '🔔 Vehicle Alert',
        body: `${name}: New event reported (${event.type})`,
      };
  }
}

// Fetch users who have access to this device
async function getDeviceUsers(deviceId) {
  try {
    const auth = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
    const response = await fetch(`${TRACCAR_URL}/api/users?deviceId=${deviceId}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[Push Server] Could not fetch device users from Traccar:', err.message);
  }
  return [];
}

// Send push notification via Expo HTTP API
async function sendExpoPush(tokens, title, body, data) {
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    priority: 'high',
    channelId: 'gts_alerts',
    data,
  }));

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const result = await res.json();
    console.log('[Push Server] Expo Push Response:', result);
  } catch (err) {
    console.error('[Push Server] Failed to contact Expo API:', err);
  }
}

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` GIANT EYE TECH - Expo Push Server Running   `);
  console.log(` Port: ${PORT}                                `);
  console.log(` Forwarding Traccar events to Expo Cloud Push `);
  console.log(`===============================================`);
});
