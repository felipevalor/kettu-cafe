/**
 * Kettu Cafe API - Pages Function
 * Handles POST requests to /api/contact
 */

export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const { name, email, message } = await request.json();

        if (!name || !email) {
            return new Response(JSON.stringify({ error: 'Missing fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Insert into D1
        // Note: In Pages Functions, env contains the D1 binding
        await env.DB.prepare(
            'INSERT INTO leads (name, email, message) VALUES (?, ?, ?)'
        )
            .bind(name, email, message || '')
            .run();

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Server error', details: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

// Handle OPTIONS for CORS (though for same-origin Pages it might not be needed)
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
