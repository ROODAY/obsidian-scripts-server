import moment from "moment";
import fetch, { Headers } from "node-fetch"; // Import fetch and Headers from node-fetch

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://health.googleapis.com/v4";

function get_credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN. " +
        "See the README for how to obtain a refresh token."
    );
  }

  return { clientId, clientSecret, refreshToken };
}

async function get_access_token() {
  const { clientId, clientSecret, refreshToken } = get_credentials();

  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("grant_type", "refresh_token");
  urlencoded.append("client_id", clientId);
  urlencoded.append("client_secret", clientSecret);
  urlencoded.append("refresh_token", refreshToken);

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: urlencoded,
    redirect: "follow",
  };

  const response = await fetch(TOKEN_URL, requestOptions);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch access token: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.access_token;
}

function to_date_range(date) {
  const start = moment(date, "YYYY-MM-DD", true);
  if (!start.isValid()) {
    throw new Error(`Invalid date "${date}". Expected YYYY-MM-DD.`);
  }

  return {
    start: start.format("YYYY-MM-DD"),
    end: start.clone().add(1, "day").format("YYYY-MM-DD"),
  };
}

async function get_sleep_data_points(date, access_token) {
  const { start, end } = to_date_range(date);

  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  myHeaders.append("authorization", `Bearer ${access_token}`);

  const points = [];
  let pageToken;

  do {
    const url = new URL(`${API_BASE}/users/me/dataTypes/sleep/dataPoints`);
    url.searchParams.set("pageSize", "25");
    url.searchParams.set(
      "filter",
      `sleep.interval.civil_end_time >= "${start}" AND sleep.interval.civil_end_time < "${end}"`
    );
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: myHeaders,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch sleep data: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    points.push(...(data.dataPoints ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return points;
}

function to_minutes(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) ? minutes : null;
}

function format_duration(minutes) {
  if (minutes === null) {
    return "unknown";
  }

  return `${Math.floor(minutes / 60)} hours, ${minutes % 60} minutes`;
}

function format_efficiency(summary) {
  const minutesAsleep = to_minutes(summary.minutesAsleep);
  const minutesInSleepPeriod = to_minutes(summary.minutesInSleepPeriod);

  if (
    minutesAsleep === null ||
    minutesInSleepPeriod === null ||
    minutesInSleepPeriod <= 0
  ) {
    return "unknown";
  }

  return String(Math.round((minutesAsleep / minutesInSleepPeriod) * 100));
}

function format_local_time(timestamp, utcOffset) {
  const offsetSeconds = Number.parseInt(String(utcOffset ?? ""), 10);
  const time = moment.utc(timestamp);

  if (Number.isFinite(offsetSeconds)) {
    return time.utcOffset(offsetSeconds / 60).format("h:mm a");
  }

  return time.format("h:mm a");
}

async function getFitbitSleepData(date) {
  const access_token = await get_access_token();
  const dataPoints = await get_sleep_data_points(date, access_token);

  const mainSleepData = dataPoints.find(
    (dataPoint) => dataPoint.sleep?.metadata?.mainSleep === true
  )?.sleep;

  if (!mainSleepData) {
    throw new Error("No main sleep data found for the given date.");
  }

  const summary = mainSleepData.summary ?? {};
  const interval = mainSleepData.interval ?? {};

  return [
    `\t- Efficiency: ${format_efficiency(summary)}`,
    `\t- Time in bed: ${format_duration(
      to_minutes(summary.minutesInSleepPeriod)
    )}`,
    `\t- Time asleep: ${format_duration(to_minutes(summary.minutesAsleep))}`,
    `\t- Sleep start: ${format_local_time(
      interval.startTime,
      interval.startUtcOffset
    )}`,
    `\t- Sleep end: ${format_local_time(
      interval.endTime,
      interval.endUtcOffset
    )}`,
  ].join("\r\n");
}

export default getFitbitSleepData;
