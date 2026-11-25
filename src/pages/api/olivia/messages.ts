import type { APIRoute } from 'astro';
import { oliviaSnapshotRequest } from '../../../lib/olivia';
export const prerender = false;
export const GET: APIRoute = ({ request }) => oliviaSnapshotRequest(request);
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'GET' } });
