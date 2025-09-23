// ✅ Allowed in ES2017
const map = new Map();
const p = Promise.resolve(42);

// ❌ Syntax beyond ES2017
const nLiteral = 10n;              // BigInt literal (ES2020)
const optionalChaining = map?.size; // Optional chaining (ES2020)
const nullishCoalescing = p ?? 0;   // Nullish coalescing (ES2020)

// ❌ Built-ins beyond ES2017
const nGlobal = BigInt(10);                     // BigInt() constructor
const objFromEntries = Object.fromEntries([["a", 1]]); // ES2019
Promise.allSettled([p, Promise.resolve(0)]);             // ES2020
