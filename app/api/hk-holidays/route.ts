const HOLIDAY_ICAL = "https://www.1823.gov.hk/common/ical/tc.ics";

export async function GET() {
  try {
    const response = await fetch(HOLIDAY_ICAL, { headers: { accept: "text/calendar" } });
    if (!response.ok) throw new Error(`1823 returned ${response.status}`);
    const calendar = (await response.text()).replace(/\r?\n[ \t]/g, "");
    const holidays: Record<string, string> = {};

    for (const event of calendar.split("BEGIN:VEVENT").slice(1)) {
      const date = event.match(/DTSTART;VALUE=DATE:(\d{8})/)?.[1];
      const summary = event.match(/\r?\nSUMMARY:(.+)/)?.[1]?.trim();
      if (!date || !summary) continue;
      holidays[`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`] = summary
        .replaceAll("\\,", ",")
        .replaceAll("\\;", ";");
    }

    return Response.json({ holidays, source: HOLIDAY_ICAL, updatedAt: new Date().toISOString() }, {
      headers: { "cache-control": "public, max-age=21600, s-maxage=86400" },
    });
  } catch {
    return Response.json({ holidays: {}, source: HOLIDAY_ICAL, error: "holiday_feed_unavailable" }, { status: 502 });
  }
}
