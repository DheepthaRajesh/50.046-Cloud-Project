const express = require('express');
const sql = require('mssql');
const bodyParser = require('body-parser');
const cors = require('cors');
const { SerialPort, ReadlineParser } = require('serialport');
const app = express();
const port = process.env.PORT || 3000;


const OCCUPANCY_COOLDOWN = 5*1000; // 15 minutes in millisecond
app.use(cors({
  origin: 'http://localhost:4200'
}));

const dbConfig = {
    user: 'admin',
    password: 'Admin12345',
    server: 'cloudproject-1.ct84m0a2yv9m.ap-southeast-1.rds.amazonaws.com',
    port: 1433,
    database: 'MotionSensorDB',
    options: {
        trustServerCertificate: true,
        encrypt: false
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};
let lastOccupancyChange = {
  timestamp: null,
  state: 0
};

let pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect()
    .then(() => {
        console.log('Successfully connected to SQL Server');
        console.log('Database:', dbConfig.database);
        console.log('Server:', dbConfig.server);
    })
    .catch(err => {
        console.error('Failed to connect to SQL Server:', err);
    });

async function initializePool() {
    try {
        if (pool) {
            if (!pool.connected && !pool.connecting) {
                pool = await new sql.ConnectionPool(dbConfig).connect();
            }
        } else {
            pool = await new sql.ConnectionPool(dbConfig).connect();
        }
        console.log('Successfully connected to SQL Server');
        return pool;
    } catch (err) {
        console.error('Failed to create connection pool:', err);
        throw err;
    }
}

async function executeQuery(query, params) {
    try {
        if (!pool || !pool.connected) {
            await initializePool();
        }
        const request = pool.request();
        if (params) {
            for (const key in params) {
                request.input(key, params[key].type, params[key].value);
            }
        }
        return await request.query(query);
    } catch (err) {
        if (err.code === 'ECONNCLOSED') {
            await initializePool();
            return executeQuery(query, params);
        }
        throw err;
    }
}

const serialPort = new SerialPort({
    path: 'COM9',
    baudRate: 115200,
});

const parser = serialPort.pipe(new ReadlineParser());

// Track last saved states and timestamps
let lastSavedStates = {
    pir1: null,
    pir2: null,
    lastSaveTime: new Date()
};

async function processSensorData(pir1Value, pir2Value, forceUpdate = false) {
  try {
      const currentTime = new Date();
      const timeSinceLastSave = currentTime - lastSavedStates.lastSaveTime;
      
      const shouldSave = forceUpdate || 
                        timeSinceLastSave >= 300000 || 
                        pir1Value !== lastSavedStates.pir1 ||
                        pir2Value !== lastSavedStates.pir2;

      if (shouldSave) {
          // Insert PIR1 data
          await executeQuery(
              `INSERT INTO pir_sensor_data (table_id, raw_PIR_data, PIR_Status, timestamp)
               VALUES (@table_id, @raw_PIR_data, @PIR_Status, @timestamp)`,
              {
                  table_id: { type: sql.Int, value: 3 },
                  raw_PIR_data: { type: sql.Float, value: pir1Value },
                  PIR_Status: { type: sql.Bit, value: pir1Value === 1 ? 1 : 0 },
                  timestamp: { type: sql.DateTime, value: currentTime }
              }
          );

          // Insert PIR2 data
          await executeQuery(
              `INSERT INTO pressure_sensor_data (table_id, raw_Pressure_data, Pressure_Status, timestamp)
               VALUES (@table_id, @raw_Pressure_data, @Pressure_Status, @timestamp)`,
              {
                  table_id: { type: sql.Int, value: 3 },
                  raw_Pressure_data: { type: sql.Float, value: pir2Value },
                  Pressure_Status: { type: sql.Bit, value: pir2Value === 1 ? 1 : 0 },
                  timestamp: { type: sql.DateTime, value: currentTime }
              }
          );

          // Check current occupancy state
          const wouldBeOccupied = pir1Value === 1 && pir2Value === 1 ? 1 : 0;
          let shouldUpdateOccupancy = false;
          let finalOccupancyState = lastOccupancyChange.state;

          // If sensors indicate occupancy and we're currently unoccupied
          if (wouldBeOccupied === 1 && lastOccupancyChange.state === 0) {
              shouldUpdateOccupancy = true;
              finalOccupancyState = 1;
          } 
          // If sensors indicate no occupancy and we're currently occupied
          else if (wouldBeOccupied === 0 && lastOccupancyChange.state === 1) {
              // Check if cooldown period has passed
              const timeSinceLastOccupancy = currentTime - lastOccupancyChange.timestamp;
              if (timeSinceLastOccupancy >= OCCUPANCY_COOLDOWN) {
                  shouldUpdateOccupancy = true;
                  finalOccupancyState = 0;
              }
          }

          // Update occupancy if needed
          if (shouldUpdateOccupancy) {
              await executeQuery(
                  `MERGE occupancy_status AS target
                   USING (SELECT @table_id as table_id) AS source
                   ON (target.table_id = source.table_id)
                   WHEN MATCHED THEN
                       UPDATE SET 
                           Occupancy = @Occupancy,
                           timestamp = @timestamp
                   WHEN NOT MATCHED THEN
                       INSERT (table_id, Occupancy, timestamp)
                       VALUES (@table_id, @Occupancy, @timestamp);`,
                  {
                      table_id: { type: sql.Int, value: 3 },
                      Occupancy: { type: sql.Bit, value: finalOccupancyState },
                      timestamp: { type: sql.DateTime, value: currentTime }
                  }
              );

              // Update last occupancy change tracking
              lastOccupancyChange = {
                  timestamp: currentTime,
                  state: finalOccupancyState
              };

              console.log('Updated occupancy:', {
                  timestamp: currentTime,
                  newState: finalOccupancyState,
                  reason: finalOccupancyState === 1 ? 'Both sensors active' : 'Cooldown period passed'
              });
          }

          lastSavedStates = {
              pir1: pir1Value,
              pir2: pir2Value,
              lastSaveTime: currentTime
          };

          console.log('Updated sensor data:', {
              timestamp: currentTime,
              pir1: pir1Value,
              pir2: pir2Value,
              currentOccupancy: lastOccupancyChange.state
          });
      }
  } catch (err) {
      console.error('Error processing sensor data:', err);
  }
}
parser.on('data', async (data) => {
    console.log('Raw data from COM9:', data);

    try {
        const matches = data.match(/PIR1: (\d+) \| PIR2: (\d+)/);
        
        if (matches) {
            const pir1Value = parseInt(matches[1]);
            const pir2Value = parseInt(matches[2]);
            
            console.log('Parsed PIR values:', {
                PIR1: pir1Value,
                PIR2: pir2Value
            });

            await processSensorData(pir1Value, pir2Value);
        }
    } catch (err) {
        console.error('Error processing sensor data:', err);
    }
});

// Periodic save every 5 minutes
setInterval(async () => {
    if (lastSavedStates.pir1 !== null && lastSavedStates.pir2 !== null) {
        await processSensorData(lastSavedStates.pir1, lastSavedStates.pir2, true);
    }
}, 300000);

// Error handling for serial port
serialPort.on('error', (err) => {
    console.error('Serial Port Error:', err);
});

// API endpoints
app.get('/pir-sensor/:tableId', async (req, res) => {
    try {
        const result = await executeQuery(
            `SELECT TOP 100 
                table_id,
                raw_PIR_data,
                CASE WHEN PIR_Status = 1 THEN 'Motion Detected' ELSE 'No Motion' END as PIR_Status,
                timestamp
            FROM pir_sensor_data 
            WHERE table_id = @table_id
            ORDER BY timestamp DESC`,
            {
                table_id: { type: sql.Int, value: req.params.tableId }
            }
        );
        
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

app.get('/pressure-sensor/:tableId', async (req, res) => {
    try {
        const result = await executeQuery(
            `SELECT TOP 100 
                table_id,
                raw_Pressure_data,
                CASE WHEN Pressure_Status = 1 THEN 'Vibration Detected' ELSE 'No Vibration' END as Pressure_Status,
                timestamp
            FROM pressure_sensor_data 
            WHERE table_id = @table_id
            ORDER BY timestamp DESC`,
            {
                table_id: { type: sql.Int, value: req.params.tableId }
            }
        );
        
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

app.get('/table-status/:tableId', async (req, res) => {
    try {
        const pirResult = await executeQuery(
            `SELECT TOP 1 
                table_id,
                raw_PIR_data,
                CASE WHEN PIR_Status = 1 THEN 'Motion Detected' ELSE 'No Motion' END as PIR_Status,
                timestamp
            FROM pir_sensor_data
            WHERE table_id = @table_id
            ORDER BY timestamp DESC`,
            {
                table_id: { type: sql.Int, value: req.params.tableId }
            }
        );

        const pressureResult = await executeQuery(
            `SELECT TOP 1 
                table_id,
                raw_Pressure_data,
                CASE WHEN Pressure_Status = 1 THEN 'Vibration Detected' ELSE 'No Vibration' END as Pressure_Status,
                timestamp
            FROM pressure_sensor_data
            WHERE table_id = @table_id
            ORDER BY timestamp DESC`,
            {
                table_id: { type: sql.Int, value: req.params.tableId }
            }
        );

        const occupancyResult = await executeQuery(
            `SELECT TOP 1 *
            FROM occupancy_status
            WHERE table_id = @table_id
            ORDER BY timestamp DESC`,
            {
                table_id: { type: sql.Int, value: req.params.tableId }
            }
        );

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

async function initialize() {
    try {
        await initializePool();
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (err) {
        console.error('Failed to initialize server:', err);
        process.exit(1);
    }
}

// Start the server
initialize();