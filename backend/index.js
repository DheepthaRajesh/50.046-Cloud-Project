const express = require('express');
const sql = require('mssql');
const bodyParser = require('body-parser');

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
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;

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
            return executeQuery(query, params); // Retry once
        }
        throw err;
    }
}

async function simulateDataInsertion() {
    try {
        const tableId = 3;
        const currentTime = new Date();
        
        const pirValue = Math.random() * 100;
        const pressureValue = Math.random() * 100;
        const pirStatus = pirValue > 1 ? 1 : 0;
        const pressureStatus = pressureValue > 1 ? 1 : 0;

        // Insert PIR data
        await executeQuery(
            `INSERT INTO pir_sensor_data (table_id, raw_PIR_data, PIR_Status, timestamp)
             VALUES (@table_id, @raw_PIR_data, @PIR_Status, @timestamp)`,
            {
                table_id: { type: sql.Int, value: tableId },
                raw_PIR_data: { type: sql.Float, value: pirValue },
                PIR_Status: { type: sql.Bit, value: pirStatus },
                timestamp: { type: sql.DateTime, value: currentTime }
            }
        );

        // Insert pressure data
        await executeQuery(
            `INSERT INTO pressure_sensor_data (table_id, raw_Pressure_data, Pressure_Status, timestamp)
             VALUES (@table_id, @raw_Pressure_data, @Pressure_Status, @timestamp)`,
            {
                table_id: { type: sql.Int, value: tableId },
                raw_Pressure_data: { type: sql.Float, value: pressureValue },
                Pressure_Status: { type: sql.Bit, value: pressureStatus },
                timestamp: { type: sql.DateTime, value: currentTime }
            }
        );

        console.log('Simulated data inserted successfully:', {
            time: currentTime,
            pirValue,
            pirStatus,
            pressureValue,
            pressureStatus
        });
    } catch (err) {
        console.error('Error inserting simulated data:', err);
    }
}
async function checkAndUpdateOccupancy() {
  try {
      for (let tableId = 1; tableId <= 8; tableId++) {
          try {
              const result = await executeQuery(
                  `DECLARE @latestPIR bit, @latestPressure bit;

                  SELECT TOP 1 @latestPIR = PIR_Status
                  FROM pir_sensor_data 
                  WHERE table_id = @table_id
                  ORDER BY timestamp DESC;

                  SELECT TOP 1 @latestPressure = Pressure_Status
                  FROM pressure_sensor_data
                  WHERE table_id = @table_id
                  ORDER BY timestamp DESC;

                  SELECT @latestPIR as PIR_Status, @latestPressure as Pressure_Status;`,
                  {
                      table_id: { type: sql.Int, value: tableId }
                  }
              );

              const sensorData = result.recordset[0];
              
              if (sensorData && (sensorData.PIR_Status !== null || sensorData.Pressure_Status !== null)) {
                  const isOccupied = sensorData.PIR_Status === true && sensorData.Pressure_Status === true ? 1 : 0;

                  // Use MERGE statement to update or insert
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
                          table_id: { type: sql.Int, value: tableId },
                          Occupancy: { type: sql.Bit, value: isOccupied },
                          timestamp: { type: sql.DateTime, value: new Date() }
                      }
                  );

                  console.log(`Updated occupancy for table ${tableId}:`, {
                      PIR_Status: sensorData.PIR_Status,
                      Pressure_Status: sensorData.Pressure_Status,
                      Occupancy: isOccupied
                  });
              }
          } catch (err) {
              console.error(`Error processing table ${tableId}:`, err);
              continue;
          }
      }
      console.log('Completed occupancy status update for all tables');
  } catch (err) {
      console.error('Error in checkAndUpdateOccupancy:', err);
  }
}
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
        
        setInterval(simulateDataInsertion, 30000);
        setInterval(checkAndUpdateOccupancy, 5 * 60 * 1000);
        
        await simulateDataInsertion();
        await checkAndUpdateOccupancy();
        
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