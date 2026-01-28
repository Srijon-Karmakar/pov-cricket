import fs from "fs";
import path from "path";

const src = path.join(process.cwd(), "node_modules", "three-stdlib", "libs", "draco");
const dest = path.join(process.cwd(), "public", "draco");

fs.mkdirSync(dest, { recursive: true });

for (const f of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
}

console.log("✅ Draco files copied to public/draco/");
