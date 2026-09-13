/**
 * ============================================================
 * Yahoo 奇摩值 - 每日自動簽到
 * ============================================================
 *
 * 流程：
 *
 * 儲存的 Yahoo Cookie
 *       ↓
 * GET /challenges
 *       ↓
 * 檢查今天是否已經簽到
 *       ↓
 * GET /crumb
 *       ↓
 * 取得 Yahoo Crumb
 *       ↓
 * POST /actions/checkin
 *       ↓
 * 解析 Yahoo 回傳結果
 *       ↓
 * Surge 通知
 *
 * ============================================================
 */


// ============================================================
// 基本設定
// ============================================================

const BASE_URL =
    "https://loyalty.media.yahoo.com/api/membership/v2";


const COOKIE_KEY =
    "yahoo_kimo_cookie";


const UA_KEY =
    "yahoo_kimo_user_agent";


// ============================================================
// 解析 Surge 模組參數
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

            const index =
                item.indexOf("=");

            if (index === -1) {
                return;
            }


            const key =
                decodeURIComponent(
                    item.substring(
                        0,
                        index
                    )
                );


            const value =
                decodeURIComponent(
                    item.substring(
                        index + 1
                    )
                );


            result[key] =
                value;
        });


    return result;
}


// ============================================================
// Boolean
// ============================================================

function getBoolean(
    value,
    defaultValue
) {

    if (
        value === undefined
    ) {
        return defaultValue;
    }


    value =
        String(value)
            .toLowerCase();


    return ![
        "false",
        "0",
        "off",
        "no"
    ].includes(value);
}


// ============================================================
// Config
// ============================================================

const args =
    parseArguments();


const config = {

    notify:
        getBoolean(
            args.notify,
            true
        ),

    debug:
        getBoolean(
            args.debug,
            false
        )
};


// ============================================================
// Debug Log
// ============================================================

function debug(message) {

    if (
        config.debug
    ) {

        console.log(
            "[Yahoo Kimo] " +
            message
        );
    }
}


// ============================================================
// 通知
// ============================================================

function notify(
    subtitle,
    message
) {

    if (
        !config.notify
    ) {
        return;
    }


    $notification.post(
        "Yahoo 奇摩值",
        subtitle,
        message
    );
}


// ============================================================
// 台灣日期 YYYY-MM-DD
// ============================================================

function getTaiwanDate() {

    const now =
        new Date();


    const taiwan =
        new Date(
            now.getTime() +
            8 *
            60 *
            60 *
            1000
        );


    return taiwan
        .toISOString()
        .slice(
            0,
            10
        );
}


// ============================================================
// HTTP GET
// ============================================================

function httpGet(options) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            $httpClient.get(
                options,
                (
                    error,
                    response,
                    data
                ) => {

                    if (error) {

                        reject(
                            error
                        );

                        return;
                    }


                    resolve({

                        status:
                            response.statusCode ||
                            response.status ||
                            0,

                        headers:
                            response.headers ||
                            {},

                        data:
                            data || ""
                    });
                }
            );
        }
    );
}


// ============================================================
// HTTP POST
// ============================================================

function httpPost(options) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            $httpClient.post(
                options,
                (
                    error,
                    response,
                    data
                ) => {

                    if (error) {

                        reject(
                            error
                        );

                        return;
                    }


                    resolve({

                        status:
                            response.statusCode ||
                            response.status ||
                            0,

                        headers:
                            response.headers ||
                            {},

                        data:
                            data || ""
                    });
                }
            );
        }
    );
}


// ============================================================
// JSON 安全解析
// ============================================================

function safeJSON(data) {

    try {

        return JSON.parse(
            data
        );

    } catch {

        return null;
    }
}


// ============================================================
// 解析 Yahoo Crumb
// ============================================================

function parseCrumb(data) {

    if (!data) {
        return "";
    }


    // --------------------------------------------------------
    // JSON
    // --------------------------------------------------------

    const json =
        safeJSON(data);


    if (json !== null) {

        // API 直接回傳 JSON String
        if (
            typeof json === "string"
        ) {

            return json.trim();
        }


        // {
        //   "crumb": "xxxxx"
        // }
        if (
            json.crumb
        ) {

            return String(
                json.crumb
            ).trim();
        }


        // {
        //   "data": {
        //      "crumb":"..."
        //   }
        // }
        if (
            json.data &&
            json.data.crumb
        ) {

            return String(
                json.data.crumb
            ).trim();
        }


        // {
        //   "result":{
        //      "crumb":"..."
        //   }
        // }
        if (
            json.result &&
            json.result.crumb
        ) {

            return String(
                json.result.crumb
            ).trim();
        }
    }


    // --------------------------------------------------------
    // 純文字
    // --------------------------------------------------------

    return String(data)
        .trim()
        .replace(
            /^"/,
            ""
        )
        .replace(
            /"$/,
            ""
        );
}


// ============================================================
// Yahoo Request Headers
// ============================================================

function createHeaders(
    cookie,
    userAgent,
    includeContentType
) {

    const headers = {

        "Cookie":
            cookie,

        "Accept":
            "application/json",

        "Accept-Language":
            "zh-TW,zh-Hant;q=0.9",

        "User-Agent":
            userAgent
    };


    if (
        includeContentType
    ) {

        headers[
            "Content-Type"
        ] =
            "application/json";
    }


    return headers;
}


// ============================================================
// 檢查今天是否已簽到
// ============================================================

async function checkAlreadyCompleted(
    cookie,
    userAgent
) {

    debug(
        "查詢今日任務狀態..."
    );


    const response =
        await httpGet({

            url:
                BASE_URL +
                "/challenges?appId=media-tw",

            headers:
                createHeaders(
                    cookie,
                    userAgent,
                    false
                )
        });


    debug(
        "Challenges HTTP " +
        response.status
    );


    if (
        response.status !== 200
    ) {

        // 無法判斷就繼續嘗試簽到
        return false;
    }


    const json =
        safeJSON(
            response.data
        );


    if (
        !json ||
        !Array.isArray(
            json.challenges
        )
    ) {

        return false;
    }


    const challenge =
        json.challenges.find(
            item => {

                if (!item) {
                    return false;
                }


                const name =
                    String(
                        item.name ||
                        ""
                    );


                const actionType =
                    String(
                        item.defaultActionType ||
                        ""
                    ).toLowerCase();


                return (
                    name.includes(
                        "每日簽到"
                    ) ||
                    actionType ===
                    "checkin"
                );
            }
        );


    if (!challenge) {

        debug(
            "找不到每日簽到 Challenge"
        );

        return false;
    }


    debug(
        "找到每日簽到 Challenge"
    );


    const current =
        Number(
            challenge.currentExecutionTimes
        );


    const max =
        Number(
            challenge.maxExecutionTimes
        );


    if (
        Number.isFinite(current) &&
        Number.isFinite(max) &&
        max > 0 &&
        current >= max
    ) {

        return true;
    }


    // 其他可能的完成狀態
    const state =
        String(
            challenge.state ||
            ""
        ).toUpperCase();


    if (
        [
            "COMPLETED",
            "COMPLETE",
            "DONE"
        ].includes(state)
    ) {

        return true;
    }


    return false;
}


// ============================================================
// 取得 Crumb
// ============================================================

async function getCrumb(
    cookie,
    userAgent
) {

    debug(
        "開始取得 Crumb..."
    );


    const response =
        await httpGet({

            url:
                BASE_URL +
                "/crumb",

            headers:
                createHeaders(
                    cookie,
                    userAgent,
                    false
                )
        });


    debug(
        "Crumb HTTP " +
        response.status
    );


    if (
        response.status !== 200
    ) {

        throw new Error(
            "取得 Crumb 失敗：HTTP " +
            response.status
        );
    }


    const crumb =
        parseCrumb(
            response.data
        );


    if (!crumb) {

        throw new Error(
            "Yahoo 有回應，但無法解析 Crumb"
        );
    }


    // 不印出真正 Crumb
    debug(
        "Crumb 取得成功，長度：" +
        crumb.length
    );


    return crumb;
}


// ============================================================
// 執行 Check-in
// ============================================================

async function checkin(
    cookie,
    userAgent,
    crumb
) {

    const contextId =
        getTaiwanDate();


    debug(
        "今日 contextId：" +
        contextId
    );


    const requestBody = {

        appId:
            "media-tw",

        property:
            "super",

        contextId:
            contextId,

        crumb:
            crumb
    };


    const response =
        await httpPost({

            url:
                BASE_URL +
                "/actions/checkin",

            headers:
                createHeaders(
                    cookie,
                    userAgent,
                    true
                ),

            body:
                JSON.stringify(
                    requestBody
                )
        });


    debug(
        "Check-in HTTP " +
        response.status
    );


    // 不輸出 Cookie / Crumb
    if (
        config.debug
    ) {

        console.log(
            "[Yahoo Kimo] Response: " +
            response.data
        );
    }


    return response;
}


// ============================================================
// 解析非 200 錯誤
// ============================================================

function parseErrorMessage(data) {

    if (!data) {

        return "Yahoo 沒有回傳錯誤內容";
    }


    const json =
        safeJSON(data);


    if (json) {

        return (
            json.message ||
            json.error ||
            json.errorMessage ||
            JSON.stringify(
                json
            )
        );
    }


    return String(data);
}


// ============================================================
// 主程式
// ============================================================

async function main() {

    console.log(
        "[Yahoo Kimo] ===== 開始執行 ====="
    );


    // --------------------------------------------------------
    // Cookie
    // --------------------------------------------------------

    const cookie =
        $persistentStore.read(
            COOKIE_KEY
        );


    if (!cookie) {

        notify(
            "❌ 尚未取得登入資訊",
            "請先開啟 Yahoo App → 奇摩值任務頁面，讓 Surge 自動擷取 Cookie。"
        );


        console.log(
            "[Yahoo Kimo] 找不到 Cookie"
        );


        return;
    }


    debug(
        "Cookie 已取得，長度：" +
        cookie.length
    );


    // --------------------------------------------------------
    // User-Agent
    // --------------------------------------------------------

    const storedUA =
        $persistentStore.read(
            UA_KEY
        );


    const userAgent =
        storedUA ||
        "super/5.4.0/iOS";


    debug(
        "User-Agent：" +
        userAgent
    );


    // --------------------------------------------------------
    // 檢查今天是否已經簽到
    // --------------------------------------------------------

    try {

        const alreadyCompleted =
            await checkAlreadyCompleted(
                cookie,
                userAgent
            );


        if (
            alreadyCompleted
        ) {

            notify(
                "☑️ 今日已完成",
                "今天的 Yahoo 奇摩值每日簽到已經完成，不重複執行。"
            );


            console.log(
                "[Yahoo Kimo] 今日已簽到"
            );


            return;
        }

    } catch (error) {

        // Challenge 查詢失敗不阻止真正簽到

        debug(
            "檢查 Challenge 失敗：" +
            String(error)
        );
    }


    // --------------------------------------------------------
    // 取得 Crumb
    // --------------------------------------------------------

    const crumb =
        await getCrumb(
            cookie,
            userAgent
        );


    // --------------------------------------------------------
    // 執行簽到
    // --------------------------------------------------------

    const response =
        await checkin(
            cookie,
            userAgent,
            crumb
        );


    // ========================================================
    // HTTP 200
    // ========================================================

    if (
        response.status === 200
    ) {

        const result =
            safeJSON(
                response.data
            );


        // ----------------------------------------------------
        // Yahoo 正常成功回傳
        //
        // {
        //   "completedChallengeCount":1,
        //   "actionName":"checkin",
        //   "experiencePoint":1,
        //   "challengeName":"每日簽到",
        //   "defaultRewardPoint":1
        // }
        // ----------------------------------------------------

        if (result) {

            const challengeName =
                result.challengeName ||
                "每日簽到";


            const reward =
                result.defaultRewardPoint ??
                result.experiencePoint ??
                "?";


            const completedCount =
                result.completedChallengeCount;


            let message =
                "獲得 +" +
                reward +
                " 奇摩值";


            if (
                completedCount !== undefined
            ) {

                message +=
                    "｜完成任務 " +
                    completedCount +
                    " 項";
            }


            notify(
                "✅ " +
                challengeName +
                "成功",
                message
            );


            console.log(
                "[Yahoo Kimo] 簽到成功 +" +
                reward
            );


            return;
        }


        // 200 但 JSON 不同
        notify(
            "✅ 每日簽到成功",
            "Yahoo 已接受本次簽到。"
        );


        return;
    }


    // ========================================================
    // 非 200
    // ========================================================

    let errorMessage =
        parseErrorMessage(
            response.data
        );


    const lower =
        errorMessage
            .toLowerCase();


    // --------------------------------------------------------
    // 已完成
    // --------------------------------------------------------

    if (
        lower.includes(
            "already"
        ) ||
        lower.includes(
            "completed"
        ) ||
        errorMessage.includes(
            "已完成"
        ) ||
        errorMessage.includes(
            "已簽到"
        )
    ) {

        notify(
            "☑️ 今日已簽到",
            "Yahoo 顯示今天的每日簽到已完成。"
        );


        return;
    }


    // --------------------------------------------------------
    // Cookie / 登入可能失效
    // --------------------------------------------------------

    if (
        response.status === 401 ||
        response.status === 403
    ) {

        notify(
            "❌ Yahoo 登入資訊可能已失效",
            "HTTP " +
            response.status +
            "。請重新開啟 Yahoo App → 奇摩值任務頁面，讓 Surge 更新 Cookie。"
        );


        return;
    }


    // --------------------------------------------------------
    // 其他錯誤
    // --------------------------------------------------------

    if (
        errorMessage.length >
        180
    ) {

        errorMessage =
            errorMessage.substring(
                0,
                180
            ) +
            "...";
    }


    notify(
        "⚠️ 每日簽到失敗",
        "HTTP " +
        response.status +
        "｜" +
        errorMessage
    );
}


// ============================================================
// 執行
// ============================================================

main()
    .catch(error => {

        console.log(
            "[Yahoo Kimo] Error: " +
            String(error)
        );


        notify(
            "❌ 執行發生錯誤",
            String(
                error.message ||
                error
            )
        );

    })
    .then(() => {

        console.log(
            "[Yahoo Kimo] ===== 執行結束 ====="
        );


        $done();
    });
