#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMoteMcpServer } from './server.js';
import { realDeps } from './tools.js';

const server = createMoteMcpServer(realDeps);
await server.connect(new StdioServerTransport());
