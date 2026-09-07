import viewer from '@mote/viewer';

import { isProbeRequest } from './boundary.js';

export default {
  async fetch(request: Request, env: Pick<ProbeEnv, 'DOCUMENTS'>): Promise<Response> {
    if (!isProbeRequest(request)) {
      return new Response('404 Not Found', { status: 404 });
    }
    // Leave /.well-known/* unchanged to observe whether Access intercepts it.
    const response = await viewer.fetch(request, env);
    const result = new Response(response.body, response);
    result.headers.set('X-Mote-Probe', 'phase-0-viewer');
    return result;
  },
} satisfies ExportedHandler<Pick<ProbeEnv, 'DOCUMENTS'>>;
