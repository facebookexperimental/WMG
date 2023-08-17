// export const handler = async(event) => {
//     // TODO implement
//     const response = {
//         statusCode: 200,
//         body: JSON.stringify('Hello from Lambda!'),
//     };
//     return response;
// };

import mysql from 'mysql';
import { promisify } from 'util';

// Environment variables for database connection
// const db_host = process.env.DB_HOST;
const db_host = "wmg-database-instance-1.c7vvpektphnh.sa-east-1.rds.amazonaws.com";
// const db_user = process.env.DB_USER;
const db_user = "admin";
// const db_pass = process.env.DB_PASS;
const db_pass = "wmg_d4t4b4s3_S3nha!";
// const db_name = process.env.DB_NAME;
const db_name = "wmg-db";

export const handler = async (event, context) => {
    const http_method = event.httpMethod;
    const path_parameters = event.pathParameters;

    // Connect to the database
    const connection = mysql.createConnection({
        host: db_host,
        user: db_user,
        password: db_pass,
        database: db_name
    });

    const query = promisify(connection.query).bind(connection);

    try {
        if (http_method === 'GET') {
            if ('record_id' in path_parameters) {
                const record_id = path_parameters['record_id'];
                const result = await query(`SELECT * FROM keywords WHERE id=${record_id}`);
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(result)
                };
            } else {
                const result = await query('SELECT * FROM keywords');
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(result)
                };
            }
        } else if (http_method === 'POST') {
            const data = JSON.parse(event.body);
            const name = data.name;
            const age = data.age;
            const result = await query(`INSERT INTO your_table (name, age) VALUES ('${name}', ${age})`);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: result.insertId,
                    name: name,
                    age: age
                })
            };
        } else if (http_method === 'PUT') {
            const data = JSON.parse(event.body);
            const record_id = path_parameters['record_id'];
            const name = data.name;
            const age = data.age;
            await query(`UPDATE your_table SET name='${name}', age=${age} WHERE id=${record_id}`);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: record_id,
                    name: name,
                    age: age
                })
            };
        } else if (http_method === 'DELETE') {
            const record_id = path_parameters['record_id'];
            await query(`DELETE FROM your_table WHERE id=${record_id}`);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: record_id
                })
            };
        } else {
            return {
                statusCode: 405,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Method Not Allowed'
                })
            };
        }
    } catch (error) {
        console.log("ERROR123:", error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal Server Error'
            })
        };
    } finally {
        // Close the database connection
        connection.end();
    }
};

