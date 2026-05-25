const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "src", "routes", "admin.tsx");
let c = fs.readFileSync(p, "utf8");

// Arreglar useEffect de redireccion
c = c.replace(
  '  // Si no hay token, redirigir a /login (solo en cliente)',
  '  // Si no hay token en localStorage, redirigir a /login'
);
c = c.replace(
  "    if (!token && typeof window !== 'undefined') {",
  "    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {"
);
c = c.replace("  }, [token]);", "  }, []);");

// Arreglar iconos rotos
c = c.replace(/"\?\?"/g, '"📊"');

fs.writeFileSync(p, c, "utf8");
console.log("OK");
