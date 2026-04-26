import { httpRouter } from "convex/server";
import { importResults, importFixtures } from "./resultsImport";

const http = httpRouter();

http.route({
  path: "/api/import-results",
  method: "POST",
  handler: importResults,
});

http.route({
  path: "/api/import-fixtures",
  method: "POST",
  handler: importFixtures,
});

export default http;
