// The only place Google's OAuth client secret ever touches a request. The
// browser (src/lib/googleCalendar.ts) posts here with everything except
// credentials — this function attaches GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
// from Netlify's environment (Site settings → Environment variables, never
// committed to the repo) and forwards to Google, so the secret never ships
// in the built JS bundle.
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'server_not_configured',
        error_description: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set on this Netlify site.',
      }),
    }
  }

  const params = new URLSearchParams(event.body ?? '')
  params.set('client_id', clientId)
  params.set('client_secret', clientSecret)

  const googleRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  const text = await googleRes.text()
  return {
    statusCode: googleRes.status,
    headers: { 'Content-Type': 'application/json' },
    body: text,
  }
}
