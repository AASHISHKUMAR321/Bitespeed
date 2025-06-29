import * as mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/mysql2';

dotenv.config();

// Create a connection pool instead of a single connection
const poolPromise = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bitspeed',
});

// Test the connection by getting a connection from the pool
poolPromise.getConnection()
    .then(connection => {
        console.log('Database connected successfully');
        connection.release(); // Release the connection back to the pool
    })
    .catch(err => {
        console.error('Database connection failed:', err);
    });

// Create the drizzle instance with the pool
export const db = drizzle(poolPromise);

export default poolPromise;