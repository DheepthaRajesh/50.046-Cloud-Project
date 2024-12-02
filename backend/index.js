const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const sql = require('mssql');

const app = express();
const port = process.env.PORT || 3000;

// Database configuration
const dbConfig = {
    user: 'admin',
    password: 'Admin12345',
    server: 'cloudproject-1.ct84m0a2yv9m.ap-southeast-1.rds.amazonaws.com',
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

pool.on('close', () => {
    console.log('Database connection pool closed');
});

const serialPort = new SerialPort({
  path: 'COM9',
  baudRate: 115200,
});

const parser = serialPort.pipe(new ReadlineParser());

// Store both motion and vibration states
let sensorState = {
  motion: {
    isActive: false,
    lastDetected: null,
    lastEnded: null,
    events: []
  },
  vibration: {
    isActive: false,
    lastDetected: null,
    lastEnded: null,
    events: []
  }
};

serialPort.on('error', (err) => {
  console.error('Serial Port Error:', err);
});

parser.on('data', (data) => {
  const cleanData = data;
  console.log('data', data);

  if (cleanData) {
    if (cleanData.startsWith('IP Address:')) {
      console.log('\x1b[36m%s\x1b[0m', '[Network]', cleanData);
    }
    else if (cleanData.startsWith('Signal strength')) {
      console.log('\x1b[36m%s\x1b[0m', '[Network]', cleanData);
    }
    else if (cleanData.includes('SD Card') || cleanData.includes('picture')) {
      console.log('\x1b[90m%s\x1b[0m', '[Storage]', cleanData);
    }
    // Handle Motion Detection
    else if (cleanData.includes('Motion detected at:')) {
      const timestamp = cleanData.replace('Motion detected at: ', '').trim();
      sensorState.motion.isActive = true;
      sensorState.motion.lastDetected = timestamp;
      sensorState.motion.events.push({
        type: 'detected',
        timestamp: new Date().toISOString(),
        esp32Time: timestamp
      });
      console.log('\x1b[32m%s\x1b[0m', '[MOTION START]', timestamp);
    }
    // Handle Motion End
    else if (cleanData.includes('Motion ended at:')) {
      const timestamp = cleanData.replace('Motion ended at: ', '').trim();
      sensorState.motion.isActive = false;
      sensorState.motion.lastEnded = timestamp;
      sensorState.motion.events.push({
        type: 'ended',
        timestamp: new Date().toISOString(),
        esp32Time: timestamp
      });
      console.log('\x1b[33m%s\x1b[0m', '[MOTION END]', timestamp);
    }
    // Handle Vibration Detection
    else if (cleanData.includes('Vibration detected at:')) {
      const timestamp = cleanData.replace('Vibration detected at: ', '').trim();
      sensorState.vibration.isActive = true;
      sensorState.vibration.lastDetected = timestamp;
      sensorState.vibration.events.push({
        type: 'detected',
        timestamp: new Date().toISOString(),
        esp32Time: timestamp
      });
      console.log('\x1b[35m%s\x1b[0m', '[VIBRATION START]', timestamp);
    }
    // Handle Vibration End
    else if (cleanData.includes('Vibration ended at:')) {
      const timestamp = cleanData.replace('Vibration ended at: ', '').trim();
      sensorState.vibration.isActive = false;
      sensorState.vibration.lastEnded = timestamp;
      sensorState.vibration.events.push({
        type: 'ended',
        timestamp: new Date().toISOString(),
        esp32Time: timestamp
      });
      console.log('\x1b[35m%s\x1b[0m', '[VIBRATION END]', timestamp);
    }
  }
});

// Keep only last 10 events for each sensor
function trimEvents() {
  if (sensorState.motion.events.length > 10) {
    sensorState.motion.events = sensorState.motion.events.slice(-10);
  }
  if (sensorState.vibration.events.length > 10) {
    sensorState.vibration.events = sensorState.vibration.events.slice(-10);
  }
}

// Add these after your existing requires
const bodyParser = require('body-parser');
app.use(bodyParser.json());

// Save PIR sensor data
async function savePIREvent(tableId, event) {
    try {
        await pool.request()
            .input('table_id', sql.Int, tableId)
            .input('raw_PIR_data', sql.VarChar(255), event.esp32Time)
            .input('PIR_Status', sql.VarChar(50), event.type === 'detected' ? 'Motion Detected' : 'No Motion')
            .input('timestamp', sql.DateTime, new Date(event.timestamp))
            .query(`
                INSERT INTO pir_sensor_data (table_id, raw_PIR_data, PIR_Status, timestamp)
                VALUES (@table_id, @raw_PIR_data, @PIR_Status, @timestamp)
            `);
    } catch (err) {
        console.error('Error saving PIR event:', err);
        throw err;
    }
}

// Save pressure sensor data
async function savePressureEvent(tableId, event) {
    try {
        await pool.request()
            .input('table_id', sql.Int, tableId)
            .input('raw_Pressure_data', sql.VarChar(255), event.esp32Time)
            .input('Pressure_Status', sql.VarChar(50), event.type === 'detected' ? 'Vibration Detected' : 'No Vibration')
            .input('timestamp', sql.DateTime, new Date(event.timestamp))
            .query(`
                INSERT INTO pressure_sensor_data (table_id, raw_Pressure_data, Pressure_Status, timestamp)
                VALUES (@table_id, @raw_Pressure_data, @Pressure_Status, @timestamp)
            `);
    } catch (err) {
        console.error('Error saving pressure event:', err);
        throw err;
    }
}

// Update your parser.on('data') event handler
parser.on('data', async (data) => {
    // ... existing code ...
    
    if (cleanData.includes('Motion detected at:') || cleanData.includes('Motion ended at:')) {
        const event = sensorState.motion.events[sensorState.motion.events.length - 1];
        try {
            await savePIREvent(1, event); // Replace 1 with actual table_id
        } catch (err) {
            console.error('Failed to save PIR event:', err);
        }
    }
    
    if (cleanData.includes('Vibration detected at:') || cleanData.includes('Vibration ended at:')) {
        const event = sensorState.vibration.events[sensorState.vibration.events.length - 1];
        try {
            await savePressureEvent(1, event); // Replace 1 with actual table_id
        } catch (err) {
            console.error('Failed to save pressure event:', err);
        }
    }
});

// Get PIR sensor data by table_id
app.get('/pir-sensor/:tableId', async (req, res) => {
    try {
        const result = await pool.request()
            .input('table_id', sql.Int, req.params.tableId)
            .query(`
                SELECT TOP 100 * FROM pir_sensor_data 
                WHERE table_id = @table_id
                ORDER BY timestamp DESC
            `);
        
        if (result.recordset.length === 0) {
            res.status(404).json({ message: 'No PIR sensor data found for this table' });
        } else {
            res.json(result.recordset);
        }
    } catch (err) {
        console.error('Error retrieving PIR sensor data:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get pressure sensor data by table_id
app.get('/pressure-sensor/:tableId', async (req, res) => {
    try {
        const result = await pool.request()
            .input('table_id', sql.Int, req.params.tableId)
            .query(`
                SELECT TOP 100 * FROM pressure_sensor_data 
                WHERE table_id = @table_id
                ORDER BY timestamp DESC
            `);
        
        if (result.recordset.length === 0) {
            res.status(404).json({ message: 'No pressure sensor data found for this table' });
        } else {
            res.json(result.recordset);
        }
    } catch (err) {
        console.error('Error retrieving pressure sensor data:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get latest sensor status for a table
app.get('/table-status/:tableId', async (req, res) => {
    try {
        // Get latest PIR status
        const pirResult = await pool.request()
            .input('table_id', sql.Int, req.params.tableId)
            .query(`
                SELECT TOP 1 *
                FROM pir_sensor_data
                WHERE table_id = @table_id
                ORDER BY timestamp DESC
            `);

        // Get latest pressure status
        const pressureResult = await pool.request()
            .input('table_id', sql.Int, req.params.tableId)
            .query(`
                SELECT TOP 1 *
                FROM pressure_sensor_data
                WHERE table_id = @table_id
                ORDER BY timestamp DESC
            `);

        // Get latest occupancy status
        const occupancyResult = await pool.request()
            .input('table_id', sql.Int, req.params.tableId)
            .query(`
                SELECT TOP 1 *
                FROM occupancy_status
                WHERE table_id = @table_id
                ORDER BY timestamp DESC
            `);

        res.json({
            pir_sensor: pirResult.recordset[0] || null,
            pressure_sensor: pressureResult.recordset[0] || null,
            occupancy: occupancyResult.recordset[0] || null,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error retrieving table status:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});