import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest does not auto-clean without globals, so mounted trees would otherwise
// accumulate across cases and make queries ambiguous.
afterEach(cleanup);
