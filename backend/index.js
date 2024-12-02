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

// Single pool instance
let pool;

// Initialize pool function
async function initializePool() {
    try {
        if (pool) {
            // If pool exists but is closed, create a new one
            if (!pool.connected && !pool.connecting) {
                pool = await new sql.ConnectionPool(dbConfig).connect();
            }
        } else {
            // Create new pool if none exists
            pool = await new sql.ConnectionPool(dbConfig).connect();
        }
        console.log('Successfully connected to SQL Server');
        return pool;
    } catch (err) {
        console.error('Failed to create connection pool:', err);
        throw err;
    }
}

// Wrapper function for database queries
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

// Simulate sensor data insertion
async function simulateDataInsertion() {
    try {
        const tableId = 2;
        const currentTime = new Date();
        
        const pirValue = Math.random() * 100;
        const pressureValue = Math.random() * 100;
        const pirStatus = pirValue > 50 ? 1 : 0;
        const pressureStatus = pressureValue > 50 ? 1 : 0;

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

                    await executeQuery(
                        `INSERT INTO occupancy_status (table_id, Occupancy, timestamp)
                         VALUES (@table_id, @Occupancy, @timestamp)`,
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

// Initialize everything
async function initialize() {
    try {
        await initializePool();
        
        // Set up intervals
        setInterval(simulateDataInsertion, 30000);
        setInterval(checkAndUpdateOccupancy, 5 * 60 * 1000);
        
        // Run initial checks
        await simulateDataInsertion();
        await checkAndUpdateOccupancy();
        
        // Start the server
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