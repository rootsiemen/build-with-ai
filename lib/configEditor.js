const { getByPath, setByPath, flattenObject } = require('./contextBuilder');

/**
 * Serializes a context value for display, mirroring the `context` command's
 * 90-character truncation.
 * @param {any} value
 * @returns {string}
 */
function summarizeValue(value) {
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 90 ? `${text.substring(0, 87)}...` : text;
}

/**
 * Serializes a context value for the editor's input default.
 * @param {any} value
 * @returns {string}
 */
function formatEditorValue(value) {
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

/**
 * Parses editor input exactly like the `set` command parses CLI values:
 * valid JSON is stored as JSON, everything else stays a string.
 * @param {string} raw
 * @returns {any}
 */
function parseEditorValue(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Runs the interactive config editor: pick a recorded decision from a list,
 * edit its value (JSON is parsed automatically), and save atomically.
 *
 * @param {object} params
 * @param {object} params.context Context object, mutated in place on save.
 * @param {object} params.inquirer Inquirer-compatible prompter ({ prompt }).
 * @param {(context: object) => void} params.save Persists the updated context.
 * @returns {Promise<{updated: boolean, key?: string, before?: any, after?: any, reason?: string}>}
 */
async function runConfigEditor({ context, inquirer, save }) {
  const flat = flattenObject(context || {});
  const entries = Object.entries(flat);
  if (entries.length === 0) {
    return { updated: false, reason: 'empty' };
  }

  const { selectedKey } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedKey',
      message: 'Select a decision to edit:',
      choices: entries.map(([key, value]) => ({ name: `${key}: ${summarizeValue(value)}`, value: key }))
    }
  ]);

  const before = getByPath(context, selectedKey);
  const { rawValue } = await inquirer.prompt([
    {
      type: 'input',
      name: 'rawValue',
      message: `New value for "${selectedKey}" (JSON is parsed automatically, blank cancels):`,
      default: formatEditorValue(before)
    }
  ]);

  if (rawValue.trim() === '') {
    return { updated: false, key: selectedKey, reason: 'cancelled' };
  }

  const after = parseEditorValue(rawValue);
  if (JSON.stringify(after) === JSON.stringify(before)) {
    return { updated: false, key: selectedKey, reason: 'unchanged' };
  }
  if (!setByPath(context, selectedKey, after)) {
    return { updated: false, key: selectedKey, reason: 'rejected' };
  }
  save(context);
  return { updated: true, key: selectedKey, before, after };
}

module.exports = {
  summarizeValue,
  formatEditorValue,
  parseEditorValue,
  runConfigEditor
};
