import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bitspeed',
});

// Test the connection
pool.connect((err)=>{
    if(err){
        console.log('Database connection failed',err)
        return
    }
    console.log('Database connected')
})


export default pool;