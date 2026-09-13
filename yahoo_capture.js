/**
 * Yahoo 奇摩值 Cookie 擷取
 */

const COOKIE_KEY = "yahoo_kimo_cookie";

const headers = $request.headers || {};

const cookie =
  headers["Cookie"] ||
  headers["cookie"] ||
  "";

if (!cookie) {
  console.log("Yahoo 奇摩值：找不到 Cookie");
  $done({});
}

const oldCookie = $persistentStore.read(COOKIE_KEY);

if (cookie !== oldCookie) {
  $persistentStore.write(cookie, COOKIE_KEY);

  console.log("Yahoo 奇摩值 Cookie 已更新");

  $notification.post(
    "Yahoo 奇摩值",
    "Cookie 擷取成功",
    "已儲存最新 Yahoo 登入資訊"
  );
} else {
  console.log("Yahoo 奇摩值 Cookie 無變化");
}

$done({});
