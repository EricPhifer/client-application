import type { Handler } from '@netlify/functions';
import { createClient } from '@libsql/client/web';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const prospectId = event.queryStringParameters?.id;

  if (!prospectId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing prospect ID' }),
    };
  }

  try {
    const result = await turso.execute({
      sql: 'SELECT business_name, contact_name, email, website_url FROM prospects WHERE id = ?',
      args: [prospectId],
    });

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Prospect not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.rows[0]),
    };
  } catch (error) {
    console.error('Error fetching prospect:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
