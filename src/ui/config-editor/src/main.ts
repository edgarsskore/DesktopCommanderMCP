/**
 * Thin browser entrypoint that boots the Config Editor app once DOM is ready. Keeping startup in this file makes testing and bundling boundaries explicit.
 */
import { bootstrapConfigEditor } from './app.js';

bootstrapConfigEditor();
