/**
 * ============================================================
 * Yahoo 奇摩值 - Cookie 自動擷取
 * ============================================================
 *
 * 功能：
 * 1. 攔截 Yahoo 奇摩值 /challenges API
 * 2. 自動取得登入 Cookie
 * 3. 儲存 User-Agent
 * 4. 儲存到 Surge Persistent Store
 *
 * GitHub:
 * howsingsong/yahoo-kimo-surge
 *
 * ============================================================
 */


// ============================================================
// 儲存名稱
// ============================================================

const COOKIE_KEY = "yahoo_kimo_cookie";
const UA_KEY = "yahoo_kimo_user_agent";
const NOTICE_TIME_KEY = "yahoo_kimo_capture_notice_time";


// ============================================================
// 解析 Surge argument
// ============================================================

function parseArguments() {

    const result = {};

    if (
        typeof $argument === "undefined" ||
        !$argument
    ) {
        return result;
    }

    String($argument)
        .split("&")
        .forEach(item => {

            const index = item.indexOf("=");

            if (index === -1) {
                return;
            }

            const key = decodeURIComponent(
                item.substring(0, index)
            );

            const value = decodeURIComponent(
                item.substring(index + 1)
            );

            result[key] = value;
        });

    return result;
}


// ============================================================
// Boolean 參數
// ============================================================

function getBoolean(value, defaultValue) {

    if (value === undefined) {
        return defaultValue;
    }

    value = String(value).toLowerCase();

    return ![
        "false",
        "0",
        "no",
        "off"
    ].includes(value);
}


// ============================================================
// Header 不分大小寫取得
// ============================================================

function getHeader(headers, name) {

    if (!headers) {
        return "";
    }

    const target = name.toLowerCase();

    for (const key in headers) {

        if (key.toLowerCase() === target) {

            const value = headers[key];

            if (Array.isArray(value)) {
                return value.join("; ");
            }

            return String(value || "");
        }
    }

    return "";
}


// ============================================================
// Debug
// ============================================================

const args = parseArguments();

const config = {

    captureNotify:
        getBoolean(
            args.capture_notify,
            true
        ),

    debug:
        getBoolean(
            args.debug,
            false
        )
};


function debug(message) {

    if (config.debug) {
        console.log(
            "[Yahoo Kimo Capture] " + message
        );
    }
}


// ============================================================
// 主程式
// ============================================================

try {

    if (
        typeof $request === "undefined" ||
        !$request
    ) {

        console.log(
            "[Yahoo Kimo Capture] 找不到 $request"
        );

        $done({});
    }


    const headers =
        $request.headers || {};


    // --------------------------------------------------------
    // Cookie
    // --------------------------------------------------------

    const cookie =
        getHeader(
            headers,
            "cookie"
        );


    // --------------------------------------------------------
    // User-Agent
    // --------------------------------------------------------

    const userAgent =
        getHeader(
            headers,
            "user-agent"
        );


    if (!cookie) {

        debug(
            "這次請求沒有 Cookie"
        );

        $done({});
    }


    const oldCookie =
        $persistentStore.read(
            COOKIE_KEY
        ) || "";


    const cookieChanged =
        oldCookie !== cookie;


    // --------------------------------------------------------
    // 儲存 Cookie
    // --------------------------------------------------------

    const cookieSaved =
        $persistentStore.write(
            cookie,
            COOKIE_KEY
        );


    // --------------------------------------------------------
    // 儲存 User-Agent
    // --------------------------------------------------------

    if (userAgent) {

        $persistentStore.write(
            userAgent,
            UA_KEY
        );
    }


    debug(
        "Cookie 長度：" +
        cookie.length
    );

    debug(
        "Cookie 是否更新：" +
        cookieChanged
    );

    debug(
        "Cookie 儲存結果：" +
        cookieSaved
    );

    if (userAgent) {

        debug(
            "User-Agent 已儲存"
        );
    }


    // ========================================================
    // Cookie 更新通知
    //
    // 避免 Yahoo 每次更新小 Cookie 都一直洗通知：
    // 最多每 6 小時提醒一次。
    // ========================================================

    if (
        config.captureNotify &&
        cookieChanged
    ) {

        const now =
            Date.now();

        const oldNoticeTime =
            Number(
                $persistentStore.read(
                    NOTICE_TIME_KEY
                ) || 0
            );


        const sixHours =
            6 *
            60 *
            60 *
            1000;


        if (
            !oldCookie ||
            now - oldNoticeTime > sixHours
        ) {

            $notification.post(
                "Yahoo 奇摩值",
                "✅ 登入資訊已擷取",
                "Yahoo Cookie 已儲存，可執行自動簽到。"
            );


            $persistentStore.write(
                String(now),
                NOTICE_TIME_KEY
            );
        }
    }


} catch (error) {

    console.log(
        "[Yahoo Kimo Capture] Error: " +
        String(error)
    );

}


$done({});
