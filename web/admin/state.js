import { createSession } from '../shared/session.js';
import { createApi } from '../shared/api.js';

export const session = createSession('drinkit.admin');
export const api = createApi(session);
