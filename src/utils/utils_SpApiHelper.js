function utils_getSpApiAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty("LWA_CLIENT_ID");
  const clientSecret = props.getProperty("LWA_CLIENT_SECRET");
  const refreshToken = props.getProperty("LWA_REFRESH_TOKEN");
  const tokenEndpoint = props.getProperty("LWA_TOKEN_ENDPOINT") || "https://api.amazon.com/auth/o2/token";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("LWA認証情報がScript Propertiesに設定されていません。\nLWA_CLIENT_ID, LWA_CLIENT_SECRET, LWA_REFRESH_TOKENを確認してください。");
  }

  const payload = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  };

  const options = {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: payload,
    muteHttpExceptions: true
  };

  console.log("アクセストークンを取得中...");
  const response = UrlFetchApp.fetch(tokenEndpoint, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    console.error("LWAトークン取得エラー:", responseBody);
    throw new Error("アクセストークンの取得に失敗しました (HTTP " + responseCode + "): " + responseBody);
  }

  const tokenData = JSON.parse(responseBody);

  if (!tokenData.access_token) {
    throw new Error("アクセストークンがレスポンスに含まれていません");
  }

  console.log("アクセストークンを取得しました");
  return tokenData.access_token;
}

function utils_getSpApiConfig() {
  const props = PropertiesService.getScriptProperties();

  const config = {
    SELLER_ID: props.getProperty("SELLER_ID"),
    MARKETPLACE_ID: props.getProperty("MARKETPLACE_ID"),
    SP_API_ENDPOINT: props.getProperty("SP_API_ENDPOINT") || "https://sellingpartnerapi-fe.amazon.com"
  };

  if (!config.SELLER_ID || !config.MARKETPLACE_ID) {
    throw new Error("SP-API設定がScript Propertiesに設定されていません。\nSELLER_ID, MARKETPLACE_IDを確認してください。");
  }

  return config;
}

function utils_makeSpApiRequest(url, method, body, accessToken, options) {
  options = options || {};

  const headers = {
    "x-amz-access-token": accessToken,
    "Accept": "application/json"
  };

  if (options.useAuthorizationHeader) {
    headers["Authorization"] = "Bearer " + accessToken;
  }

  const fetchOptions = {
    method: method,
    headers: headers,
    muteHttpExceptions: true
  };

  if (body && (method === "post" || method === "put" || method === "patch")) {
    fetchOptions.contentType = "application/json";
    fetchOptions.payload = JSON.stringify(body);
  }

  const response = UrlFetchApp.fetch(url, fetchOptions);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  return {
    code: responseCode,
    body: responseBody,
    json: function() {
      try {
        return JSON.parse(responseBody);
      } catch (e) {
        return null;
      }
    }
  };
}

function utils_makeSpApiRequestWithRetry(url, method, body, accessToken, options) {
  options = options || {};
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = utils_makeSpApiRequest(url, method, body, accessToken, options);

    if (response.code === 429) {
      console.log("レート制限に達しました。" + (retryDelay / 1000) + "秒待機します... (試行 " + attempt + "/" + maxRetries + ")");
      if (attempt < maxRetries) {
        Utilities.sleep(retryDelay);
        continue;
      }
    }

    return response;
  }

  throw new Error("最大リトライ回数を超えました");
}

function utils_handleSpApiError(response, operationName) {
  const code = response.code;
  const body = response.body;

  let errorMessage = body;

  try {
    const errorData = JSON.parse(body);
    if (errorData.errors && errorData.errors.length > 0) {
      errorMessage = errorData.errors.map(function(e) {
        return (e.code || "ERROR") + ": " + (e.message || e.details || "不明なエラー");
      }).join("\n");
    } else if (errorData.message) {
      errorMessage = errorData.message;
    }
  } catch (e) {
    // JSONパースに失敗した場合はそのまま使用
  }

  throw new Error(operationName + "に失敗しました (HTTP " + code + "):\n" + errorMessage);
}

function utils_getSourceAddress() {
  const props = PropertiesService.getScriptProperties();

  const address = {
    name: props.getProperty("SHIP_FROM_NAME"),
    addressLine1: props.getProperty("SHIP_FROM_ADDRESS_LINE1"),
    addressLine2: props.getProperty("SHIP_FROM_ADDRESS_LINE2") || "",
    city: props.getProperty("SHIP_FROM_CITY"),
    stateOrProvinceCode: props.getProperty("SHIP_FROM_STATE"),
    postalCode: props.getProperty("SHIP_FROM_POSTAL_CODE"),
    countryCode: props.getProperty("SHIP_FROM_COUNTRY_CODE") || "JP",
    phoneNumber: props.getProperty("SHIP_FROM_PHONE")
  };

  if (!address.name || !address.addressLine1 || !address.city || !address.postalCode || !address.phoneNumber) {
    throw new Error("出荷元住所がScript Propertiesに設定されていません。\nSHIP_FROM_NAME, SHIP_FROM_ADDRESS_LINE1, SHIP_FROM_CITY, SHIP_FROM_POSTAL_CODE, SHIP_FROM_PHONEを確認してください。");
  }

  return address;
}

function utils_buildSpApiUrl(endpoint, path, queryParams) {
  let url = endpoint + path;

  if (queryParams) {
    const params = [];
    for (const key in queryParams) {
      if (queryParams.hasOwnProperty(key) && queryParams[key] !== undefined && queryParams[key] !== null) {
        params.push(encodeURIComponent(key) + "=" + encodeURIComponent(queryParams[key]));
      }
    }
    if (params.length > 0) {
      url += "?" + params.join("&");
    }
  }

  return url;
}
