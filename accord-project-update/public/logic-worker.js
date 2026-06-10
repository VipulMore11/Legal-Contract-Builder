/**
 * Accord Project Logic Execution Worker
 * Evaluates user-authored contract logic in a sandboxed Web Worker context.
 */
'use strict';

function transpileTS(code) {
  let out = code;
  out = out.replace(/^[ \t]*import\s+type\b[^\n]*/gm, '');
  out = out.replace(/^[ \t]*export\s+type\s+\w+[^\n]*/gm, '');
  out = out.replace(/\binterface\s+\w+(?:\s+extends\s+[^{]+)?\s*\{[^}]*\}/g, '');
  out = out.replace(/^[ \t]*(?:export\s+)?type\s+\w+(?:<[^>]*>)?\s*=[^\n;]+[;\n]/gm, '\n');
  out = out.replace(/(\bfunction\s+\w+)\s*<[^>]+>\s*\(/g, '$1(');
  out = out.replace(/\)\s*:\s*[A-Za-z_$][\w$.<>|&[\] ,?]*\s*(?=\{)/g, ') ');
  out = out.replace(/\)\s*:\s*[A-Za-z_$][\w$.<>|&[\] ,?]*\s*(?=>)/g, ') ');
  out = out.replace(
    /(\b\w+\b)\s*\??\s*:\s*(?:string|number|boolean|any|void|never|null|undefined|object|unknown|[A-Z][\w$.<>|&[\] ,?]*)/g,
    '$1'
  );
  return out;
}

function runFunction(logic, fnName, context) {
  const transpiled = transpileTS(logic);
  const src = `
"use strict";
${transpiled}
if (typeof ${fnName} !== "function") {
  throw new Error("'" + ${JSON.stringify(fnName)} + "' is not defined.");
}
return ${fnName}(___ctx___);
`;
  const fn = new Function('___ctx___', src);
  return fn(context);
}

self.onmessage = function (event) {
  const { id, type, logic, params, state, request } = event.data;
  try {
    if (!logic || !logic.trim()) throw new Error('Logic source is empty.');
    if (type === 'init') {
      const result = runFunction(logic, 'init', { contract: params || {} });
      if (!result || typeof result !== 'object') throw new Error('init() must return a state object.');
      self.postMessage({ id, success: true, type: 'init', state: result, emit: [] });
    } else if (type === 'dispatch') {
      if (!state) throw new Error('No contract state. Initialize the contract first.');
      if (!request) throw new Error('Request is empty.');
      const result = runFunction(logic, 'dispatch', { state, request, contract: params || {} });
      if (!result || !result.state) throw new Error("dispatch() result missing 'state'.");
      if (!result.response) throw new Error("dispatch() result missing 'response'.");
      self.postMessage({
        id, success: true, type: 'dispatch',
        state: result.state, response: result.response,
        emit: Array.isArray(result.emit) ? result.emit : [],
      });
    } else {
      throw new Error('Unknown message type: ' + type);
    }
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message || String(err), stack: err.stack || '' });
  }
};
