/**
 * Kettu Cafe API Worker
 * Handles contact form submissions and leads management.
 */

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Global CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (url.pathname === '/api/contact' && request.method === 'POST') {
			try {
				const { name, email, message } = await request.json();

				if (!name || !email) {
					return new Response(JSON.stringify({ error: 'Missing fields' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json', ...corsHeaders },
					});
				}

				// Insert into D1
				await env.DB.prepare(
					'INSERT INTO leads (name, email, message) VALUES (?, ?, ?)'
				)
					.bind(name, email, message || '')
					.run();

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			} catch (err) {
				return new Response(JSON.stringify({ error: 'Server error', details: err.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}
		}

		return new Response('Not Found', { status: 404 });
	},
};
