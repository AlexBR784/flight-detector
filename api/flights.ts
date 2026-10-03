import { handleFlightsRequest } from '../server/flightsProxy';

export const config = { runtime: 'edge', regions: ['fra1'] };

export default function handler(request: Request) { return handleFlightsRequest(request); }
