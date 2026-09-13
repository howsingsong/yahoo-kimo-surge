/**
 * Yahoo 奇摩值每日自動簽到
 */

const COOKIE_KEY = "yahoo_kimo_cookie";

const BASE_URL =
  "https://loyalty.media.yahoo.com/api/membership/v2";

const cookie = $persistentStore.read(COOKIE_KEY);

if (!cookie) {
  $notification.post(
    "Yahoo 奇摩值",
    "❌ 找不到 Cookie",
    "請先開啟 Yahoo App 的奇摩值頁面一次"
  );

  $done();
}

// ==============================
// 台灣日期 YYYY-MM-DD
// ==============================

function getTaiwanDate() {
  const now = new Date();

  // UTC + 8
  const tw = new Date(
    now.getTime() + 8 * 60 * 60 * 1000
  );

  return tw.toISOString().slice(0, 10);
}

// ==============================
// HTTP GET
// ==============================

function httpGet(options) {
  return new Promise((resolve, reject) => {
    $httpClient.get(options, (error, response, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        status:
          response.status ||
          response.statusCode ||
          0,
        headers: response.headers || {},
        data: data
      });
    });
  });
}

// ==============================
// HTTP POST
// ==============================

function httpPost(options) {
  return new Promise((resolve, reject) => {
    $httpClient.post(options, (error, response, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        status:
          response.status ||
          response.statusCode ||
          0,
        headers: response.headers || {},
        data: data
      });
    });
  });
}

// ==============================
// 解析 crumb
// ==============================

function parseCrumb(data) {
  if (!data) return "";

  try {
    const json = JSON.parse(data);

    if (typeof json === "string") {
      return json;
    }

    if (json.crumb) {
      return json.crumb;
    }

    if (json.data && json.data.crumb) {
      return json.data.crumb;
    }

    if (json.result && json.result.crumb) {
      return json.result.crumb;
    }
  } catch (e) {
    // 可能直接回傳純文字
  }

  return String(data)
    .trim()
    .replace(/^"/, "")
    .replace(/"$/, "");
}

// ==============================
// 主程式
// ==============================

async function main() {

  console.log("Yahoo 奇摩值：開始取得 crumb");

  // ------------------------------
  // 1. 取得 crumb
  // ------------------------------

  const crumbResponse = await httpGet({
    url: BASE_URL + "/crumb",

    headers: {
      "Cookie": cookie,
      "Accept": "application/json",
      "Accept-Language": "zh-TW,zh-Hant;q=0.9",
      "User-Agent": "super/5.4.0/iOS/26.6.2"
    }
  });

  console.log(
    "crumb HTTP Status:",
    crumbResponse.status
  );

  if (crumbResponse.status !== 200) {

    $notification.post(
      "Yahoo 奇摩值",
      "❌ Crumb 取得失敗",
      "HTTP " + crumbResponse.status
    );

    return;
  }

  const crumb = parseCrumb(
    crumbResponse.data
  );

  if (!crumb) {

    console.log(
      "Crumb Response:",
      crumbResponse.data
    );

    $notification.post(
      "Yahoo 奇摩值",
      "❌ 無法解析 Crumb",
      "請查看 Surge Script Log"
    );

    return;
  }

  console.log("Yahoo crumb 取得成功");

  // ------------------------------
  // 2. 今日日期
  // ------------------------------

  const contextId = getTaiwanDate();

  console.log(
    "contextId:",
    contextId
  );

  // ------------------------------
  // 3. 執行每日簽到
  // ------------------------------

  const body = {
    appId: "media-tw",
    property: "super",
    contextId: contextId,
    crumb: crumb
  };

  const response = await httpPost({
    url:
      BASE_URL +
      "/actions/checkin",

    headers: {
      "Cookie": cookie,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Accept-Language": "zh-TW,zh-Hant;q=0.9",
      "User-Agent": "super/5.4.0/iOS/26.6.2"
    },

    body: JSON.stringify(body)
  });

  console.log(
    "Checkin HTTP Status:",
    response.status
  );

  console.log(
    "Checkin Response:",
    response.data
  );

  // ------------------------------
  // 4. 判斷結果
  // ------------------------------

  if (response.status === 200) {

    try {

      const result =
        JSON.parse(response.data);

      const challenge =
        result.challengeName ||
        "每日簽到";

      const reward =
        result.defaultRewardPoint ??
        result.experiencePoint ??
        "?";

      const count =
        result.completedChallengeCount ??
        1;

      $notification.post(
        "Yahoo 奇摩值",
        "✅ " + challenge + "完成",
        "獲得 +" + reward +
        "｜完成任務 " + count + " 項"
      );

    } catch (e) {

      $notification.post(
        "Yahoo 奇摩值",
        "✅ 每日簽到完成",
        contextId
      );
    }

  } else {

    let message =
      response.data ||
      "HTTP " + response.status;

    if (message.length > 160) {
      message =
        message.substring(0, 160) +
        "...";
    }

    $notification.post(
      "Yahoo 奇摩值",
      "⚠️ 簽到未完成",
      message
    );
  }
}

// ==============================

main()
  .catch(error => {

    console.log(
      "Yahoo Checkin Error:",
      error
    );

    $notification.post(
      "Yahoo 奇摩值",
      "❌ 執行錯誤",
      String(error)
    );

  })
  .finally(() => {

    $done();

  });
