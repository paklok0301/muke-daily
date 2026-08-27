import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = "https://www.1823.gov.hk/common/ical/tc.ics";
const output = fileURLToPath(new URL("../public/hk-holidays.json", import.meta.url));

function unfoldIcal(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseHolidays(text) {
  const holidays = {};
  for (const block of unfoldIcal(text).split("BEGIN:VEVENT").slice(1)) {
    const date = block.match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/)?.slice(1);
    const summary = block.match(/\r?\nSUMMARY(?:;[^:]*)?:(.+)/)?.[1]?.trim();
    if (date && summary) holidays[`${date[0]}-${date[1]}-${date[2]}`] = summary.replaceAll("\\,", ",").replaceAll("\\;", ";");
  }
  if (!Object.keys(holidays).length) throw new Error("No public holidays found in the official calendar");
  return holidays;
}

try {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Official calendar returned ${response.status}`);
  const holidays = parseHolidays(await response.text());
  await writeFile(output, `${JSON.stringify({ holidays, source, updatedAt: new Date().toISOString() })}\n`);
  console.log(`Updated ${Object.keys(holidays).length} Hong Kong public holidays from 1823.`);
} catch (error) {
  await readFile(output);
  console.warn(`Using the committed Hong Kong holiday fallback: ${error instanceof Error ? error.message : error}`);
}
