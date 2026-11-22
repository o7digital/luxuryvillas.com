import type { APIRoute } from 'astro';
import { oliviaRequest } from '../../../lib/olivia';
export const prerender = false;
export const POST: APIRoute = ({ request, clientAddress }) => oliviaRequest(request, clientAddress, true);
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
