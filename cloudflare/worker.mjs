const SITE = 'https://ahmadramzy1.github.io';
const cors = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {...cors, 'Content-Type': 'application/json; charset=utf-8'}});
async function fetchJson(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('Upstream request failed');
  return response.json();
}
export default {
  async fetch(request) {
    if (request.headers.get('Origin') !== SITE) return new Response('Forbidden', {status: 403});
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (request.method !== 'POST') return json({error:'Method not allowed'},405);
    try {
      const body = await request.text();
      if (body.length > 4096) return json({error:'Link too long'},400);
      const overlay = new URL(JSON.parse(body).url);
      if (overlay.protocol !== 'https:' || !['botrix.live','www.botrix.live'].includes(overlay.hostname) || overlay.pathname.replace(/\/$/, '') !== '/widgets/chat') throw new Error('Invalid BotRix chat overlay URL');
      const bid = overlay.searchParams.get('bid');
      if (!bid || !/^[A-Za-z0-9_-]{1,128}$/.test(bid)) throw new Error('Invalid BotRix identifier');
      const account = await fetchJson('https://botrix.live/api/widget/v2/token?bid=' + encodeURIComponent(bid));
      if (!/^\d+$/.test(String(account.kid || ''))) throw new Error('No Kick account linked to this overlay');
      const [global, kick, twitch] = await Promise.all([
        fetchJson('https://7tv.io/v3/emote-sets/global'),
        fetchJson('https://7tv.io/v3/users/kick/' + account.kid).catch(() => null),
        /^\d+$/.test(String(account.tid || '')) ? fetchJson('https://7tv.io/v3/users/twitch/' + account.tid).catch(() => null) : null
      ]);
      const emotes = [...(global.emotes || []), ...(twitch?.emote_set?.emotes || []), ...(kick?.emote_set?.emotes || [])]
        .filter(e => typeof e.name === 'string' && /^[A-Za-z0-9]+$/.test(e.id))
        .map(e => ({name:e.name, id:e.id}));
      return json({emotes, channelFound: !!(kick?.emote_set || twitch?.emote_set)});
    } catch (e) { return json({error:e.message},400); }
  }
};

