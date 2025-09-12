#!/usr/bin/env node

/**
 * KGEN CLI - Knowledge Graph Engine Command Line Interface
 * Deterministic RDF graph compilation to artifacts with provenance tracking
 */

import { runMain } from 'citty';
import { main } from '../src/index.js';

runMain(main);