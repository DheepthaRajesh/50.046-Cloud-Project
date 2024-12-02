const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const sql = require('mssql');

const app = express();
const port = process.env.PORT || 3000;

// Database configuration
const dbConfig = {
    user: 'admin12',
    password: 'Admin@123#New',
    server: 'LAPTOP-2V9JK4V9',
    port: 1433,
    database: 'MotionSensorDB',
    options: {
        trustServerCertificate: true,
        encrypt: false
    }
};
const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect()
    .then(() => {
        console.log('Successfully connected to SQL Server');
        console.log('Database:', dbConfig.database);
        console.log('Server:', dbConfig.server);
    })
    .catch(err => {
        console.error('Failed to connect to SQL Server:', err);
    });

pool.on('error', err => {
    console.error('Database Error:', err);
});

// Optional: Event listener for when the pool is closed
pool.on('close', () => {
    console.log('Database connection pool closed');
});

const serialPort = new SerialPort({
  path: 'COM3',
  baudRate: 115200,
});

const parser = serialPort.pipe(new ReadlineParser());

// Store motion state and events
let motionState = {

  isActive: false,
  lastDetected: null,
  lastEnded: null,
  events: []
};

// Handle serial port errors
serialPort.on('error', (err) => {
  console.error('Serial Port Error:', err);
});

// Listen for parsed data
parser.on('data', (data) => {
  // Clean the data by removing extra whitespace and newlines
  const cleanData = data
  console.log('data', data)
  // Only process non-empty lines
  if (cleanData) {
    // Handle IP Address
    if (cleanData.startsWith('IP Address:')) {
      console.log('\x1b[36m%s\x1b[0m', '[Network]', cleanData);
    }
    // Handle RSSI
    else if (cleanData.startsWith('Signal strength')) {
      console.log('\x1b[36m%s\x1b[0m', '[Network]', cleanData);
    }
    // Handle SD Card messages
    else if (cleanData.includes('SD Card') || cleanData.includes('picture')) {
      console.log('\x1b[90m%s\x1b[0m', '[Storage]', cleanData);
    }
    // Handle Motion Detection
    else if (cleanData.includes('Motion detected at:')) {
      const timestamp = cleanData.replace('Motion detected at: ', '').trim();
      motionState.isActive = true;
      motionState.lastDetected = timestamp;
      motionState.events.push({
        type: 'detected',
        timestamp: new Date().toISOString(),
        esp32Time: timestamp
      });
      console.log('\x1b[32m%s\x1b[0m', '[MOTION START]', timestamp);
    }
    // Handle Motion End
    else if (cleanData.includes('Motion ended at:')) {
      const timestamp = cleanData.replace('Motion ended at: ', '').trim();
      motionState.isActive = false;
      motionState.lastEnded = timestamp;
      motionState.events.push({
        type: 'ended',
        timestamp: new Date().toISOString(),
        esp32Time: timestamp
      });
      console.log('\x1b[33m%s\x1b[0m', '[MOTION END]', timestamp);
    }
  }
});

// Keep only last 10 events
function trimEvents() {
  if (motionState.events.length > 10) {
    motionState.events = motionState.events.slice(-10);
  }
}

// Endpoint to get current sensor status
app.get('/sensor-status', (req, res) => {
  trimEvents();
  res.json({
    currentStatus: motionState.isActive ? 'Motion Detected' : 'No Motion',
    lastDetected: motionState.lastDetected,
    lastEnded: motionState.lastEnded,
    recentEvents: motionState.events,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log('Monitoring PIR sensor on COM3 at 115200 baud...');
});

// Handle process termination
process.on('SIGTERM', () => {
  serialPort.close(() => {
    console.log('Serial port closed');
    process.exit(0);
  });
});