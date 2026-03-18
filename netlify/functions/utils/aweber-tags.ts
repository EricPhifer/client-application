/**
 * Lightweight AWeber tag helper for application-assessment project.
 *
 * Reads OAuth2 tokens from the shared Turso `app_settings` table,
 * auto-refreshes on 401, and saves refreshed tokens back.
 * Uses built-in fetch — no new dependencies.
 */
import { createClient } from '@libsql/client/web'

const AWEBER_API_BASE = 'https://api.aweber.com/1.0'

interface AweberConfig {
  clientId: string
  clientSecret: string
  accountId: string
  listId: string
}

function getAweberConfig(): AweberConfig {
  return {
    clientId: process.env.AWEBER_CLIENT_ID || '',
    clientSecret: process.env.AWEBER_CLIENT_SECRET || '',
    accountId: process.env.AWEBER_ACCOUNT_ID || '',
    listId: process.env.AWEBER_LIST_ID || '',
  }
}

function isConfigured(): boolean {
  const config = getAweberConfig()
  return !!(config.clientId && config.clientSecret && config.accountId && config.listId)
}

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  })
}

async function getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const db = getDb()
  const result = await db.execute({
    sql: "SELECT key, value FROM app_settings WHERE key IN ('aweber_access_token', 'aweber_refresh_token')",
    args: [],
  })

  let accessToken: string | null = null
  let refreshToken: string | null = null
  for (const row of result.rows) {
    if (row.key === 'aweber_access_token') accessToken = row.value as string
    if (row.key === 'aweber_refresh_token') refreshToken = row.value as string
  }
  return { accessToken, refreshToken }
}

async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  const db = getDb()
  await db.batch([
    {
      sql: `INSERT INTO app_settings (key, value, updated_at)
            VALUES ('aweber_access_token', ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
      args: [accessToken, accessToken],
    },
    {
      sql: `INSERT INTO app_settings (key, value, updated_at)
            VALUES ('aweber_refresh_token', ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
      args: [refreshToken, refreshToken],
    },
  ])
}

async function refreshAccessToken(currentRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const config = getAweberConfig()
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

  const response = await fetch('https://auth.aweber.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error(`AWeber token refresh failed: ${response.status}`)
  }

  const data = await response.json() as { access_token: string; refresh_token?: string }
  const newAccess = data.access_token
  const newRefresh = data.refresh_token || currentRefreshToken

  await saveTokens(newAccess, newRefresh)
  return { accessToken: newAccess, refreshToken: newRefresh }
}

async function aweberFetch(method: string, endpoint: string, token: string, body?: unknown): Promise<Response> {
  return fetch(`${AWEBER_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Add tags to an AWeber subscriber. Creates the subscriber if not found.
 * Returns silently if AWeber is not configured — never throws.
 */
export async function addAweberTags(
  email: string,
  tags: string[],
  name?: string
): Promise<void> {
  if (!isConfigured()) {
    console.log('[AWeber] Not configured, skipping tag update')
    return
  }

  const config = getAweberConfig()
  const { accessToken, refreshToken } = await getTokens()

  if (!accessToken || !refreshToken) {
    console.warn('[AWeber] No tokens found in database, skipping tag update')
    return
  }

  let token = accessToken

  // Search for subscriber
  const searchEndpoint = `/accounts/${config.accountId}/lists/${config.listId}/subscribers?ws.op=find&email=${encodeURIComponent(email)}`
  let searchRes = await aweberFetch('GET', searchEndpoint, token)

  // Handle 401 — refresh and retry
  if (searchRes.status === 401) {
    console.log('[AWeber] Token expired, refreshing...')
    const refreshed = await refreshAccessToken(refreshToken)
    token = refreshed.accessToken
    searchRes = await aweberFetch('GET', searchEndpoint, token)
  }

  if (!searchRes.ok) {
    console.error(`[AWeber] Subscriber search failed: ${searchRes.status}`)
    return
  }

  const searchData = await searchRes.json() as { entries?: Array<{ id: string }> }

  if (searchData.entries && searchData.entries.length > 0) {
    // Subscriber exists — PATCH to add tags
    const subscriberId = searchData.entries[0].id
    const updateEndpoint = `/accounts/${config.accountId}/lists/${config.listId}/subscribers/${subscriberId}`
    const patchRes = await aweberFetch('PATCH', updateEndpoint, token, {
      tags: { add: tags },
    })
    if (!patchRes.ok) {
      console.error(`[AWeber] Failed to add tags: ${patchRes.status}`)
    } else {
      console.log(`[AWeber] Added tags ${JSON.stringify(tags)} to subscriber ${subscriberId}`)
    }
  } else {
    // Subscriber not found — create with tags
    const addEndpoint = `/accounts/${config.accountId}/lists/${config.listId}/subscribers`
    const postRes = await aweberFetch('POST', addEndpoint, token, {
      email,
      name: name || email.split('@')[0],
      tags,
    })
    if (!postRes.ok) {
      const errBody = await postRes.text()
      console.error(`[AWeber] Failed to create subscriber: ${postRes.status} ${errBody}`)
    } else {
      console.log(`[AWeber] Created subscriber ${email} with tags ${JSON.stringify(tags)}`)
    }
  }
}
